declare module 'uzip' {
  export function encode(files: Record<string, Uint8Array>): ArrayBuffer | Uint8Array
}
