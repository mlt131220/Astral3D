/**
 * 性能状态监视器，基于stats.js
 * 默认展示全部面板
 */
import ThreeStats from 'three/examples/jsm/libs/stats.module.js';
import Viewer from "#/core/viewer/Viewer.ts";

export class Stats {
    private viewer: Viewer;
    private threeStats: ThreeStats;
    private panel = 0;
    private _visible = true;

    private fns: {
        beforeRender: null | (() => void);
        afterRender: null | (() => void);
    } = {
            beforeRender: null,
            afterRender: null,
        }

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.threeStats = new ThreeStats();

        this.initEvent();

        this.init();
    }

    get domElement(): HTMLElement {
        return this.threeStats.dom;
    }

    get visible() {
        return this._visible;
    }

    set visible(visible: boolean) {
        this._visible = visible;

        this.domElement.style.display = visible ? "block" : 'none';
    }

    initEvent() {
        this.fns.beforeRender = () => {
            if (!this.visible) return;

            this.threeStats.begin();
        };
        this.viewer.addEventListener("beforeRender", this.fns.beforeRender);

        this.fns.afterRender = () => {
            if (!this.visible) return;

            this.threeStats.end();
        };
        this.viewer.addEventListener("afterRender", this.fns.afterRender);
    }

    init() {
        const canvases = this.domElement.querySelectorAll("canvas");
        canvases.forEach(canvas => {
            canvas.style.width = "5rem";
            canvas.style.height = "3rem";
            canvas.style.display = "block";
        });
    }

    showPanel(type: number | 'fps' | 'ms' | 'mb') {
        if (typeof type === 'number') {
            this.threeStats.showPanel(type);
            this.panel = type;
            return;
        }

        switch (type.toLowerCase()) {
            case 'fps':
                this.threeStats.showPanel(0);
                this.panel = 0;
                break;
            case 'ms':
                this.threeStats.showPanel(1);
                this.panel = 1;
                break;
            case 'mb':
                this.threeStats.showPanel(2);
                this.panel = 2;
                break;
        }
    }

    showAllPanels(show: boolean) {
        const canvases = this.domElement.querySelectorAll("canvas");
        canvases.forEach(canvas => {
            canvas.style.display = show ? "block" : "none";
        });

        if (!show) {
            this.showPanel(this.panel);
        }
    }

    dispose() {
        if (this.fns.beforeRender) {
            this.viewer.removeEventListener("beforeRender", this.fns.beforeRender);
            this.fns.beforeRender = null;
        }

        if (this.fns.afterRender) {
            this.viewer.removeEventListener("afterRender", this.fns.afterRender);
            this.fns.afterRender = null;
        }

        // @ts-ignore
        this.threeStats = null;
    }
}