<template>
    <v-list>
        <template v-if="connected">
            <v-list-tile avatar class="pb-1">
                <v-list-tile-avatar>
                    <v-icon class="primary white--text">grid_on</v-icon>
                </v-list-tile-avatar>
                <v-list-tile-title>
                    {{name}}
                </v-list-tile-title>
            </v-list-tile>

            <v-divider></v-divider>

            <v-list-tile class="pt-1">
                <v-list-tile-content>
                    Steps
                </v-list-tile-content>
                <v-list-tile-action>
                    <v-chip>{{steps}}</v-chip>
                </v-list-tile-action>
            </v-list-tile>

            <v-list-tile>
                <v-list-tile-content>
                    Battery
                </v-list-tile-content>
                <v-list-tile-action>
                    <v-chip><v-icon small color="green" class="pr-1" v-if="battery.charging">battery_charging_full</v-icon>{{battery.level}}%</v-chip>
                </v-list-tile-action>
            </v-list-tile>

            <v-list-tile class="pt-3">
                <v-btn flat color="primary" :disabled="loading || !connected" @click="reset">Reset</v-btn>&nbsp;
                <v-btn flat color="accent" :loading="loading" @click="toggleConnect">Disconnect</v-btn>
            </v-list-tile>
        </template>
        <v-list-tile v-else>
            <v-layout justify-center row>
                <v-btn flat @click="toggleConnect" :loading="loading" color="accent" :disabled="!bluetooth">Connect</v-btn>
            </v-layout>
        </v-list-tile>
    </v-list>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { EventHub, Events } from '@/classes/event-hub'
import { Giiker, BatteryInfo } from '@/classes/giiker'

@Component
export default class Device extends Vue {
    private bluetooth = false
    private connected = false
    private loading = false
    private name = ''
    private steps = 0
    private battery = new BatteryInfo(0)

    /* tslint:disable-next-line:max-line-length */
    // private vcs = 'http://roudai.net/visualcube/visualcube.php?fmt=png&size=160&r=y39x-30&bg=t&dist=3&sch=white,E53935,1976D2,yellow,F48FB1,69F0AE'

    // lifecycle
    // --------------------------------------------------
    private mounted() {
        this.bluetooth = Giiker.available()
    }

    private async toggleConnect() {
        this.doWithLoading(async () => {
            if (Giiker.connected()) {
                await Giiker.disconnect()
                this.connected = false
            } else {
                this.name = await Giiker.connect(this.onState, this.onSteps, this.onBattery, this.onDisconnect)
                EventHub.$emit(Events.cubeConnect, this.name)
                this.connected = true
            }
        })
    }

    private async reset() {
        this.doWithLoading(async () => {
            if (this.connected) {
                await Giiker.reset()
                EventHub.$emit(Events.cubeReset)
            }
        })
    }

    private async doWithLoading(func: () => void) {
        this.loading = true
        try {
            await func()
        } catch (e) {
            EventHub.$emit(Events.error, e)
        } finally {
            this.loading = false
        }
    }

    private onState(state: Uint8Array) {
        EventHub.$emit(Events.cubeState, state)
    }

    private onSteps(steps: number) {
        this.steps = steps
    }

    private onBattery(battery: BatteryInfo) {
        this.battery = battery
    }

    private onDisconnect(e: Event) {
        this.connected = false
        EventHub.$emit(Events.cubeDisconnect, this.name)
    }
}
</script>
