export class TransferCartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferCartError';
  }
}
