export class ResponseBodyTooLargeError extends Error {
  readonly maximumBytes: number;

  constructor(maximumBytes: number) {
    super(`Response body exceeded ${maximumBytes} bytes.`);
    this.name = 'ResponseBodyTooLargeError';
    this.maximumBytes = maximumBytes;
  }
}

export async function readResponseTextWithLimit(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new RangeError('maximumBytes must be a positive safe integer.');
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ResponseBodyTooLargeError(maximumBytes);
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let bodyText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new ResponseBodyTooLargeError(maximumBytes);
    }
    bodyText += decoder.decode(value, { stream: true });
  }

  return bodyText + decoder.decode();
}
