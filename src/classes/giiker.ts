export class BatteryInfo {
    public level: number
    public charging: boolean

    constructor(level: number, charging: boolean = false) {
        this.level = level
        this.charging = charging
    }
}

// tslint:disable-next-line:no-namespace
export namespace Giiker {
    const UUID = {
        cubeService: '0000aadb-0000-1000-8000-00805f9b34fb',
        configService: '0000aaaa-0000-1000-8000-00805f9b34fb',
        cubeCharacteristic: '0000aadc-0000-1000-8000-00805f9b34fb',
        configCharacteristic: '0000aaac-0000-1000-8000-00805f9b34fb',
        infoCharacteristic: '0000aaab-0000-1000-8000-00805f9b34fb'
    }

    const Steps = 0xcc
    const Battery = 0xb5
    const Reset = 0xa1

    let stepsCount = 0

    let device: BluetoothDevice
    let stateChar: BluetoothRemoteGATTCharacteristic
    let configChar: BluetoothRemoteGATTCharacteristic

    let stateHandler: (d: Uint8Array) => void
    let stepsHandler: (n: number) => void
    let batteryHandler: (b: BatteryInfo) => void

    export function available(): boolean {
        return window.navigator.bluetooth ? true : false
    }

    export function connected(): boolean {
        return (device && device.gatt && device.gatt.connected) ? true : false
    }

    export async function connect(onState: (d: Uint8Array) => void,
                                  onSteps: (n: number) => void,
                                  onBattery: (b: BatteryInfo) => void,
                                  onDisconnect: (this: BluetoothDevice, ev: Event) => any): Promise<string> {
        stateHandler = onState
        stepsHandler = onSteps
        batteryHandler = onBattery

        return new Promise<string>(async (resolve, reject) => {
            try {
                const f = [{ namePrefix: 'GiC' }]
                const s = [UUID.cubeService, UUID.configService]

                device = await navigator.bluetooth.requestDevice({ filters: f, optionalServices: s })
                device.ongattserverdisconnected = onDisconnect
                const server = await device.gatt!.connect()

                const stateService = await server.getPrimaryService(UUID.cubeService)
                const configService = await server.getPrimaryService(UUID.configService)

                stateChar = await stateService.getCharacteristic(UUID.cubeCharacteristic)
                configChar = await configService.getCharacteristic(UUID.configCharacteristic)
                const infoChar = await configService.getCharacteristic(UUID.infoCharacteristic)

                await infoChar.startNotifications()
                infoChar.oncharacteristicvaluechanged = onInfo
                await configChar.writeValue(Uint8Array.of(Steps))
                await configChar.writeValue(Uint8Array.of(Battery))

                await stateChar.startNotifications()
                stateChar.oncharacteristicvaluechanged = onCubeState
                resolve(device.name!)
            } catch (e) {
                reject(e)
            }
        })
    }

    export async function disconnect() {
        return new Promise(async (resolve, reject) => {
            if (connected()) {
                await device.gatt!.disconnect()
                setTimeout(resolve, 4000)
            } else {
                reject('there are no connected devices')
            }
        })
    }

    export async function reset() {
        if (connected()) {
            await configChar.writeValue(Uint8Array.of(Reset))
            await configChar.writeValue(Uint8Array.of(Steps))
        } else {
            throw new Error('there are no connected devices')
        }
    }

    function onInfo(e: any) {
        const data = new Uint8Array(e.target.value.buffer)
        if (data.length === 14) {
            if ((data[0] === Steps) && stepsHandler) {
                // tslint:disable-next-line:no-bitwise
                stepsCount = (data[1] << 24) | (data[2] << 16) | (data[3] << 8) | data[4]
                stepsHandler(stepsCount)
            } else if ((data[0] === Battery) && batteryHandler) {
                batteryHandler(new BatteryInfo(data[1], data[2] === 0x02))
            }
        }
    }

    function onCubeState(e: any) {
        stepsCount++
        if (stateHandler) {
            stateHandler(new Uint8Array(e.target.value.buffer))
        }
        if (stepsHandler) {
            stepsHandler(stepsCount)
        }
    }
}
