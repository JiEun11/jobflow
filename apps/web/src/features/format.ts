const dateFormat = new Intl.DateTimeFormat('en-CA', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul',
})

export function localDate(iso: string) {
  return dateFormat.format(new Date(iso)) + ' (Seoul)'
}
