import type { OllamaWebError } from './types.js';

export function formatOllamaWebError(error: OllamaWebError): string {
  switch (error._tag) {
    case 'Cancelled':
      return 'Request was cancelled';
    case 'ValidationError':
      return error.message;
    case 'UnexpectedError':
      return error.message;
  }
}
