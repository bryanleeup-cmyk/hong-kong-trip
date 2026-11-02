(function () {
  'use strict';

  function calculate(currency, expenses, people) {
    const paid = Object.fromEntries(people.map(name => [name, 0]));
    const shares = Object.fromEntries(people.map(name => [name, 0]));
    const debts = Object.fromEntries(people.map(name => [name, Object.fromEntries(people.map(other => [other, 0]))]));
    let total = 0;

    expenses.filter(expense => expense.currency === currency).forEach(expense => {
      const participants = Array.isArray(expense.participants) ? expense.participants.filter(name => people.includes(name)) : [];
      if (!participants.length || !people.includes(expense.payer)) return;
      const cents = Number.isInteger(expense.amountCents) ? expense.amountCents : Math.round(Number(expense.amount) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0) return;
      total += cents;
      paid[expense.payer] += cents;
      const base = Math.floor(cents / participants.length);
      const remainder = cents % participants.length;
      participants.forEach((name, index) => {
        // Keep the existing per-expense cent allocation so nobody's share changes.
        const share = base + (index < remainder ? 1 : 0);
        shares[name] += share;
        if (name !== expense.payer) debts[name][expense.payer] += share;
      });
    });

    const pairs = [];
    people.forEach((first, index) => people.slice(index + 1).forEach(second => {
      const forward = debts[first][second];
      const reverse = debts[second][first];
      if (!forward && !reverse) return;
      const firstPays = forward >= reverse;
      pairs.push({
        from: firstPays ? first : second,
        to: firstPays ? second : first,
        owed: firstPays ? forward : reverse,
        offset: firstPays ? reverse : forward,
        amount: Math.abs(forward - reverse)
      });
    }));
    return { currency, total, paid, shares, pairs, people };
  }

  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = cents => (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currencyName = currency => ({ HKD: '港币', CNY: '人民币' })[currency] || currency;

  function renderBalances(result) {
    if (!result.total) return '';
    const currency = escape(result.currency);
    return `<div class="balance-heading">${escape(currencyName(result.currency))} · 垫付与分摊</div>` + result.people.map(name =>
      `<div class="ledger-person"><strong>${escape(name)}</strong><span>已垫付<b>${currency} ${money(result.paid[name])}</b></span><span>自己承担<b>${currency} ${money(result.shares[name])}</b></span></div>`
    ).join('');
  }

  function renderSettlements(result) {
    if (!result.total) return '';
    const currency = escape(result.currency);
    return `<section class="pairwise-currency"><h4>${escape(currencyName(result.currency))} · 两两转账</h4>` + (result.pairs.length ? '<ul class="pairwise-transfers">' + result.pairs.map(pair => {
      const from = escape(pair.from), to = escape(pair.to);
      const direction = pair.amount ? `${from} → ${to}` : `${from} ↔ ${to}`;
      return `<li><div class="pairwise-total"><span>${direction}</span><strong>${pair.amount ? `${currency} ${money(pair.amount)}` : '相互抵扣后无需转账'}</strong></div><details class="pairwise-details"><summary>查看 ${from}与${to} 的计算</summary><div class="pairwise-calculation"><p><span>${from}应还${to}</span><b>${currency} ${money(pair.owed)}</b></p><p><span>减：${to}应还${from}</span><b>${currency} ${money(pair.offset)}</b></p><p class="pairwise-equation">${money(pair.owed)} − ${money(pair.offset)} = ${money(pair.amount)} ${currency}</p></div></details></li>`;
    }).join('') + '</ul>' : '<p>目前只有个人开销，无需互相转账。</p>') + '</section>';
  }

  const settlementMarkup = new WeakMap();
  function updateSettlements(element, html) {
    if (settlementMarkup.get(element) === html) return;
    const open = new Set([...element.querySelectorAll('details[open]')].map(detail => detail.querySelector('summary').textContent));
    element.innerHTML = html;
    element.querySelectorAll('details').forEach(detail => {
      detail.open = open.has(detail.querySelector('summary').textContent);
    });
    settlementMarkup.set(element, html);
  }

  const ledger = { calculate, renderBalances, renderSettlements, updateSettlements };
  if (typeof module !== 'undefined' && module.exports) module.exports = ledger;
  else window.TripLedger = ledger;
})();
