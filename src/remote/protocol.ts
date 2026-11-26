/**
 * Git smart HTTP protocol implementation.
 * Implements pkt-line encoding, service discovery, and capability negotiation.
 */

/**
 * Pkt-line format for Git protocol.
 * - Flush packet: "0000"
 * - Delimiter packet: "0001"  
 * - Data packet: 4-byte hex length (including itself) + data
 */

export interface PktLineParseResult {
  packets: (Buffer | null)[];
  nextOffset: number;
}

/**
 * Parse pkt-line format packets from buffer.
 */
export function parsePktLine(buffer: Buffer, offset: number): PktLineParseResult {
  const packets: (Buffer | null)[] = [];
  let pos = offset;

  while (pos < buffer.length) {
    if (pos + 4 > buffer.length) {
      break;
    }

    const lengthStr = buffer.toString("ascii", pos, pos + 4);
    const length = parseInt(lengthStr, 16);

    if (length === 0) {
      // Flush packet
      packets.push(null);
      pos += 4;
      break;
    }

    if (length === 1) {
      // Delimiter packet
      pos += 4;
      continue;
    }

    if (length < 4) {
      throw new Error(`Invalid pkt-line length: ${length}`);
    }

    if (pos + length > buffer.length) {
      break;
    }

    const data = buffer.subarray(pos + 4, pos + length);
    packets.push(data);
    pos += length;
  }

  return { packets, nextOffset: pos };
}

/**
 * Encode data as pkt-line packet.
 */
export function encodePktLine(data: Buffer | string): Buffer {
  const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
  const length = dataBuffer.length + 4;
  const lengthStr = length.toString(16).padStart(4, "0");

  return Buffer.concat([Buffer.from(lengthStr), dataBuffer]);
}

/**
 * Create a flush packet.
 */
export function createFlushPacket(): Buffer {
  return Buffer.from("0000");
}

/**
 * Parse service discovery response.
 */
export function parseServiceResponse(buffer: Buffer): {
  service: string;
  capabilities: string[];
  refs: Map<string, string>;
} {
  const { packets } = parsePktLine(buffer, 0);

  if (packets.length === 0) {
    throw new Error("Empty service response");
  }

  // First packet is usually "# service=git-upload-pack" etc
  const firstPacket = packets[0];
  if (!firstPacket) {
    throw new Error("Invalid service packet");
  }

  const firstLine = firstPacket.toString("utf-8").trim();
  const serviceMatch = firstLine.match(/service=(.+)/);
  const service = serviceMatch?.[1] ?? "";

  const refs = new Map<string, string>();
  let capabilities: string[] = [];

  for (let i = 1; i < packets.length; i++) {
    if (!packets[i]) {
      continue;
    }

    const line = packets[i].toString("utf-8").trim();

    if (line.length === 0) {
      continue;
    }

    // Parse "hash ref" or "hash ref\0capabilities"
    const parts = line.split("\0");
    const refPart = parts[0];
    const capPart = parts[1];

    if (refPart) {
      const [hash, ...refParts] = refPart.split(/\s+/);
      const ref = refParts.join(" ");

      if (hash && ref) {
        refs.set(ref, hash);

        // First ref may contain capabilities
        if (i === 1 && capPart) {
          capabilities = capPart.split(/\s+/);
        }
      }
    }
  }

  return { service, capabilities, refs };
}

/**
 * Build upload-pack request.
 */
export function buildUploadPackRequest(wants: string[], haves: string[] = []): Buffer {
  const lines: Buffer[] = [];

  // Add want lines
  for (let i = 0; i < wants.length; i++) {
    const line =
      i === 0 && wants.length === 1
        ? `want ${wants[i]}`
        : i === 0
          ? `want ${wants[i]} multi_ack_detailed side-band-64k ofs-delta`
          : `want ${wants[i]}`;

    lines.push(encodePktLine(line + "\n"));
  }

  // Add have lines
  for (const have of haves) {
    lines.push(encodePktLine(`have ${have}\n`));
  }

  // Indicate we're done
  lines.push(encodePktLine("done\n"));
  lines.push(createFlushPacket());

  return Buffer.concat(lines);
}

/**
 * Parse upload-pack response.
 */
export function parseUploadPackResponse(buffer: Buffer): {
  packData: Buffer;
  hasMore: boolean;
} {
  // Look for packfile signature "PACK"
  const packStart = buffer.indexOf("PACK");

  if (packStart === -1) {
    throw new Error("No packfile found in upload-pack response");
  }

  // Packfile data starts 4 bytes before PACK (the pkt-line length header)
  const packData = buffer.subarray(packStart);

  return {
    packData,
    hasMore: false
  };
}

/**
 * Build receive-pack request.
 */
export function buildReceivePackRequest(
  commands: Array<{ oldId: string; newId: string; refName: string }>
): Buffer {
  const lines: Buffer[] = [];

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if (!command) continue;
    
    const { oldId, newId, refName } = command;

    const line =
      i === 0
        ? `${oldId} ${newId} ${refName}\0 agent=gitforge/1.0\n`
        : `${oldId} ${newId} ${refName}\n`;

    lines.push(encodePktLine(line));
  }

  lines.push(createFlushPacket());

  return Buffer.concat(lines);
}

/**
 * Parse receive-pack response.
 */
export function parseReceivePackResponse(buffer: Buffer): {
  ok: boolean;
  errors: string[];
  refs: Map<string, string>;
} {
  const { packets } = parsePktLine(buffer, 0);

  const errors: string[] = [];
  const refs = new Map<string, string>();
  let ok = true;

  for (const packet of packets) {
    if (!packet) {
      continue;
    }

    const line = packet.toString("utf-8").trim();

    if (line.startsWith("unpack ok")) {
      // Unpack succeeded
    } else if (line.startsWith("unpack ")) {
      // Unpack error
      ok = false;
      errors.push(line.substring(7));
    } else if (line.startsWith("ok ")) {
      // Ref update succeeded
      refs.set(line.substring(3), "ok");
    } else if (line.startsWith("ng ")) {
      // Ref update failed
      ok = false;
      errors.push(line.substring(3));
    }
  }

  return { ok, errors, refs };
}

/**
 * Side-band channel constants.
 */
export const SIDE_BAND_CHANNELS = {
  DATA: 1,
  PROGRESS: 2,
  ERROR: 3
};

/**
 * Parse side-band packet.
 */
export function parseSideBandPacket(data: Buffer): {
  channel: number;
  payload: Buffer;
} {
  if (data.length < 1) {
    throw new Error("Invalid side-band packet");
  }

  const channel = data[0];
  const payload = data.subarray(1);

  return { channel, payload };
}

/**
 * Encode side-band packet.
 */
export function encodeSideBandPacket(channel: number, payload: Buffer | string): Buffer {
  const payloadBuffer = typeof payload === "string" ? Buffer.from(payload) : payload;
  const data = Buffer.concat([Buffer.from([channel]), payloadBuffer]);
  return data;
}

/**
 * Parse error packet.
 */
export function parseErrorPacket(data: Buffer): string {
  if (!data.toString().startsWith("ERR ")) {
    return data.toString();
  }

  return data.toString().substring(4);
}

/**
 * Encode error packet.
 */
export function encodeErrorPacket(message: string): Buffer {
  return encodePktLine(`ERR ${message}\n`);
}

/**
 * Parse shallow/unshallow packets for shallow clones.
 */
export function parseShallowPacket(data: Buffer): {
  type: "shallow" | "unshallow" | "unknown";
  hash?: string;
} {
  const line = data.toString().trim();

  if (line.startsWith("shallow ")) {
    return {
      type: "shallow",
      hash: line.substring(8)
    };
  }

  if (line.startsWith("unshallow ")) {
    return {
      type: "unshallow",
      hash: line.substring(10)
    };
  }

  return { type: "unknown" };
}

/**
 * Capability list for protocol negotiation.
 */
export const SUPPORTED_CAPABILITIES = [
  "multi_ack_detailed",
  "side-band-64k",
  "ofs-delta",
  "agent=gitforge/1.0",
  "allow-reachable-sha1-in-want"
];
