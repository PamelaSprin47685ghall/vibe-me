import { createRequire } from 'node:module';

interface WasmPack {
  typescript: unknown;
  python: unknown;
  cpp: unknown;
  rust: unknown;
  go: unknown;
  java: unknown;
  javascript: unknown;
}

interface MockMemory {
  buffer: ArrayBuffer;
}

const shimMemory: MockMemory = { buffer: new ArrayBuffer(0) };

function buildEnvMock() {
  return {
    strcmp(aPtr: number, bPtr: number): number {
      const mem = new Uint8Array(shimMemory.buffer);
      const readCString = (ptr: number): string => {
        const bytes: number[] = [];
        for (let i = ptr; i < mem.length && mem[i] !== 0; i++) {
          bytes.push(mem[i]!);
        }
        return String.fromCharCode(...bytes);
      };
      const a = readCString(aPtr);
      const b = readCString(bPtr);
      return a < b ? -1 : a > b ? 1 : 0;
    },
    memU8(ptr: number): number {
      const mem = new Uint8Array(shimMemory.buffer);
      if (ptr < 0 || ptr >= mem.length) return 0;
      return mem[ptr]!;
    },
  };
}

async function loadWasmPackWithSandbox(): Promise<WasmPack> {
  const envMock = buildEnvMock();
  
  const originalInstantiate = WebAssembly.instantiate;
  
  WebAssembly.instantiate = async function sandboxedInstantiate(
    source: BufferSource | WebAssembly.Module,
    importObject?: WebAssembly.Imports,
  ) {
    const hasEnv = importObject && (importObject as Record<string, unknown>).env != null;
    
    const enhancedImports: WebAssembly.Imports = {
      ...importObject,
      env: hasEnv ? { ...(importObject as Record<string, unknown>).env as Record<string, unknown>, ...envMock } : envMock,
    };
    
    const result: any = await originalInstantiate.call(globalThis, source, enhancedImports);
    
    if ('instance' in result) {
      const memory = result.instance.exports.memory as WebAssembly.Memory | undefined;
      if (memory && hasEnv) {
        shimMemory.buffer = memory.buffer;
      }
    }
    
    return result;
  } as typeof WebAssembly.instantiate;

  try {
    return (await import('@kreuzberg/tree-sitter-language-pack-wasm')) as unknown as WasmPack;
  } finally {
    WebAssembly.instantiate = originalInstantiate;
  }
}

export async function loadTreeSitterPack(): Promise<WasmPack> {
  return loadWasmPackWithSandbox();
}
