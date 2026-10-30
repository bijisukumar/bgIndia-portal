// AGENT: a travel agent or sales partner who brings the guest. What they are paid is agreed per agent (Agent links), not a platform cut.
export const AGENT = {
  id: 'agent',
  label: 'Agent',
  group: 'agent',
  names: ['agent'],
  // A source whose name STARTS with one of these is an agent booking too ('travel agent', 'sales partner', 'tour operator'...).
  prefixes: ['agent', 'agency', 'travelagent', 'travelagency', 'salesagent', 'salespartner', 'tourop'],
  hubLabel: 'Direct',
  icon: '🏠',
  color: '#D946EF', textColor: '#FFFFFF',
  commission: { hostPct: 0, guestPct: 0 },
  feeBreakdown: false,
}
