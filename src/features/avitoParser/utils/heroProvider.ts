import { config } from "@/features/config";
import CloudNode from "@ulixee/cloud";
import Hero from "@ulixee/hero";

export default class HeroProvider {
    private static node: CloudNode;

    // Must be started globally before using Hero
    public static async startCloudNode() {
        this.node = new CloudNode();
        await this.node.listen();
    }

    public static newHero() {
        return new Hero({
            showChrome: false,
            disableGpu: true,
            noChromeSandbox: true,
            upstreamProxyUrl: config.store.proxy.connectionUrl ?? undefined
        });
    }

    public static async closeHero(hero: Hero) {
        try {
            await hero.close();
        } catch (e) {
            console.error(`Error while closing Hero: ${e}`);
        }
    }
}