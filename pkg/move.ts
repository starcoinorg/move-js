
import { WASI } from '@wasmer/wasi/lib'
import browserBindings from '@wasmer/wasi/lib/bindings/browser'
import { lowerI64Imports } from "@wasmer/wasm-transformer"
import { WasmFs } from '@wasmer/wasmfs'
import loadMoveWasmModule from './move_bg'

export interface IMove {
  run(args?: string[]):Promise<void>
}

export interface IMoveOption {
    pwd?: string
}

export class Move implements IMove {
  private wasmFs: WasmFs
  private opts?:IMoveOption

  constructor(wasmFs: WasmFs, opts?:IMoveOption) {
    this.wasmFs = wasmFs
    this.opts = opts

    if (this.opts == null) {
      this.wasmFs.fs.mkdirpSync("/tmp")
      this.opts = {
        pwd: "/tmp"
      }
    }
  }

  async run(args?: string[]): Promise<void> {
    let opts = this.opts
    let wasi = new WASI({
        preopens: {
            [opts.pwd]: opts.pwd
        },
        
        // Arguments passed to the Wasm Module
        // The first argument is usually the filepath to the executable WASI module
        // we want to run.
        args: args,
        
        // Environment variables that are accesible to the WASI module
        env: {
          "PWD": opts.pwd
        },
        
        // Bindings that are used by the WASI Instance (fs, path, etc...)
        bindings: {
            ...browserBindings,
            fs: this.wasmFs.fs
        }
    })

    // Instantiate the WebAssembly file
    let wasmModule = await loadMoveWasmModule();
    let instance = await WebAssembly.instantiate(wasmModule, {
      ...wasi.getImports(wasmModule)
    });

    try {
      // @ts-ignore
      wasi.start(instance)                      // Start the WASI instance
    } catch(e) {
      console.error(e)
    }

    // Output what's inside of /dev/stdout!
    let stdout = await this.wasmFs.getStdOut();
    console.log('Standard Output: ' + stdout);
  }
}