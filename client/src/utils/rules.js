// 前端业务规则（与后端保持一致）
export function annualLeaveDays(hireDate, targetYear) {
  const years = targetYear - new Date(hireDate).getFullYear()
  if (years < 1) return 0
  if (years < 10) return 5
  if (years < 20) return 10
  return 15
}
