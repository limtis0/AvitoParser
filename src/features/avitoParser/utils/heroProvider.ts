import { config } from "@/features/config";
import CloudNode from "@ulixee/cloud";
import { Session } from '@ulixee/hero-core';
import Hero from "@ulixee/hero";
import { unlinkSync } from 'fs';

export default class HeroProvider {
    private static node: CloudNode;

    // Must be started globally before using Hero
    public static async startCloudNode() {
        this.node = new CloudNode();

        Session.events.on('closed', (data) => {
            if (data?.databasePath) {
                try {
                    unlinkSync(data.databasePath)
                }
                catch { }
            }
        });

        await this.node.listen();
    }

    public static newHero({ withProxy = false }: { withProxy?: boolean; } = {}) {
        return new Hero({
            showChrome: false,
            disableGpu: true,
            noChromeSandbox: true,
            upstreamProxyUrl: withProxy && config.store.proxy.connectionUrl !== null ? config.store.proxy.connectionUrl : undefined,
            upstreamProxyIpMask: {
                ipLookupService: 'api.ipify.org'
            }
        });
    }

    public static async closeHero(hero: Hero) {
        try {
            await hero.close();
            hero
        } catch (e) {
            console.error(`Error while closing Hero: ${e}`);
        }
    }
}