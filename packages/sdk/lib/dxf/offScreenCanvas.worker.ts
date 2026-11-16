import {EventDispatcher} from "three";
import * as DrawShare from "./drawShare";

function noop() {
}

class ElementProxyReceiver extends EventDispatcher {
    // @ts-ignore
    private style: {};
    // @ts-ignore
    private width: number;
    // @ts-ignore
    private height: number;
    // @ts-ignore
    private left: number;
    // @ts-ignore
    private top: number;

    constructor() {
        super();
        // 因为OrbitControls尝试设置style.touchAction;
        this.style = new Proxy({}, {
            set(target: {}, p: string | symbol, newValue: any): boolean {
                self.postMessage({
                    type: 'style',
                    data: {
                        key: p,
                        value: newValue
                    }
                });

                target[p] = newValue;

                return true;
            }
        });
    }

    get clientWidth() {
        return this.width;
    }

    get clientHeight() {
        return this.height;
    }

    get offsetLeft() {
        return this.left;
    }

    get offsetTop() {
        return this.top;
    }

    // r132 版本的 OrbitControls 会调用这两个函数，也许我们应该实现一下
    setPointerCapture() {
    }

    releasePointerCapture() {
    }

    getBoundingClientRect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height,
            right: this.left + this.width,
            bottom: this.top + this.height,
        };
    }

    // 触发事件
    handleEvent(data) {
        if (data.type === 'size') {
            this.left = data.left;
            this.top = data.top;
            this.width = data.width;
            this.height = data.height;

            return;
        }

        data.preventDefault = noop;
        data.stopPropagation = noop;
        // @ts-ignore
        this.dispatchEvent(data);
    }

    focus() {
        // no-op
    }

    // 离屏 Worker 通过同一个代理分发画布和文档事件。
    get ownerDocument() {
        return this;
    }

    getRootNode(){
        return this;
    }
}

class ProxyManager {
    private readonly targets: {};

    constructor() {
        this.targets = {};
        this.handleEvent = this.handleEvent.bind(this);
    }

    /**
     * 通过一个id，可以生成一个响应对应id信息的 ElementProxyReceiver 对象。
     * @param data
     */
    makeProxy(data: { id: number }) {
        const {id} = data;
        this.targets[id] = new ElementProxyReceiver();
    }

    getProxy(id: number) {
        return this.targets[id];
    }

    handleEvent(data) {
        this.targets[data.id].handleEvent(data.data);
    }
}


/** ---------------- worker主体  ------------------ **/
const proxyManager = new ProxyManager();
const middleObject:any = new Proxy({}, {
    set(target: {}, p: string | symbol, newValue: any): boolean {
        self.postMessage({
            type: 'middle',
            data: {
                key: p,
                value: newValue
            }
        });

        target[p] = newValue;

        return true;
    }
});

function start(data: { canvasId: number, canvas: HTMLCanvasElement, data: any,options,middleObject }) {
    const proxy = proxyManager.getProxy(data.canvasId);

    middleObject.markList = JSON.parse(data.middleObject.markList);
    middleObject.selectedRectIndex = data.middleObject.selectedRectIndex;

    DrawShare.main({
        canvas: data.canvas,
        inputElement: proxy,
        data: data.data,
        options:data.options,
        onComplete: () => {
            self.postMessage({
                type: 'complete'
            });
        },
        signal: (args: { type: 'add' | 'remove' | 'dispatch', name: string, data?: any }) => {
            self.postMessage({
                type: 'signal',
                data: args
            });
        },
        middleObject
    });
}

function makeProxy(data: { id: number }) {
    proxyManager.makeProxy(data);
}

const handlers = {
    start,
    makeProxy,
    event: proxyManager.handleEvent,
};

self.onmessage = function ({data}) {
    const fn = handlers[data.type] || DrawShare[data.type];
    if (typeof fn !== 'function') {
        throw new Error(`没有 ${data.type} 类型的处理程序!`);
    }
    fn(data.data);
};





