// "Tonie" if a name was given, otherwise e.g. "Anonymous Otter" / "Anonymer Otter".
export function useDisplayName() {
  const { t, te } = useI18n()
  return (item: { name?: string, animal?: string }) => {
    if (item.name) return item.name
    const key = `animals.${item.animal}`
    return te(key) ? t(key) : t('animals.unknown')
  }
}
