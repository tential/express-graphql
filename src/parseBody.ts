import type { IncomingMessage } from 'http';
import type { Inflate, Gunzip } from 'zlib';
import zlib from 'zlib';
import querystring from 'querystring';

import getStream, { MaxBufferError } from 'get-stream';
import httpError from 'http-errors';
import contentType from 'content-type';
import type { ParsedMediaType } from 'content-type';

type Request = IncomingMessage & { body?: unknown };

/**
 * Provided a "Request" provided by express or connect (typically a node style
 * HTTPClientRequest), Promise the body data contained.
 */
export async function parseBody(
  req: Request,
): Promise<{ [param: string]: unknown }> {
  const { body } = req;

  // If express has already parsed a body as a keyed object, use it.
  if (typeof body === 'object' && !(body instanceof Buffer)) {
    return body as { [param: string]: unknown };
  }

  // Skip requests without content types.
  if (req.headers['content-type'] === undefined) {
    return {};
  }

  const typeInfo = contentType.parse(req);

  // If express has already parsed a body as a string, and the content-type
  // was application/graphql, parse the string body.
  if (typeof body === 'string' && typeInfo.type === 'application/graphql') {
    return { query: body };
  }

  // Already parsed body we didn't recognise? Parse nothing.
  if (body != null) {
    return {};
  }

  const rawBody = await readBody(req, typeInfo);
  // Use the correct body parser based on Content-Type header.
  switch (typeInfo.type) {
    case 'application/graphql':
      return { query: rawBody };
    case 'application/json':
      if (jsonObjRegex.test(rawBody)) {
        try {
          return JSON.parse(rawBody);
        } catch {
          // Do nothing
        }
      }
      throw httpError(400, 'POST body sent invalid JSON.');
    case 'application/x-www-form-urlencoded':
      return querystring.parse(rawBody);
  }

  // If no Content-Type header matches, parse nothing.
  return {};
}

/**
 * RegExp to match an Object-opening brace "{" as the first non-space
 * in a string. Allowed whitespace is defined in RFC 7159:
 *
 *     ' '   Space
 *     '\t'  Horizontal tab
 *     '\n'  Line feed or New line
 *     '\r'  Carriage return
 */
const jsonObjRegex = /^[ \t\n\r]*\{/;

// Read and parse a request body.
async function readBody(
  req: Request,
  typeInfo: ParsedMediaType,
): Promise<string> {
  const charset = typeInfo.parameters.charset?.toLowerCase() ?? 'utf-8';

  // Assert charset encoding per JSON RFC 7159 sec 8.1
  if (charset !== 'utf8' && charset !== 'utf-8' && charset !== 'utf16le') {
    throw httpError(415, `Unsupported charset "${charset.toUpperCase()}".`);
  }

  // Get content-encoding (e.g. gzip)
  const contentEncoding = req.headers['content-encoding'];
  const encoding =
    typeof contentEncoding === 'string'
      ? contentEncoding.toLowerCase()
      : 'identity';
  // const maxBuffer = 100 * 1024; // 100kb
  const maxBuffer = 100 * 1000 * 1024; // 100mb
  const stream = decompressed(req, encoding);

  // Read body from stream.
  try {
    const buffer = await getStream.buffer(stream, { maxBuffer });
    return buffer.toString(charset);
  } catch (rawError: unknown) {
    /* istanbul ignore else: Thrown by underlying library. */
    if (rawError instanceof MaxBufferError) {
      throw httpError(413, 'Invalid body: request entity too large.');
    } else {
      const message =
        rawError instanceof Error ? rawError.message : String(rawError);
      throw httpError(400, `Invalid body: ${message}.`);
    }
  }
}

// Return a decompressed stream, given an encoding.
function decompressed(
  req: Request,
  encoding: string,
): Request | Inflate | Gunzip {
  switch (encoding) {
    case 'identity':
      return req;
    case 'deflate':
      return req.pipe(zlib.createInflate());
    case 'gzip':
      return req.pipe(zlib.createGunzip());
  }
  throw httpError(415, `Unsupported content-encoding "${encoding}".`);
}
