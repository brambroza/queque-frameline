export function generateQueueNumber(index: number) {
  return `A${String(index).padStart(3, '0')}`;
}
