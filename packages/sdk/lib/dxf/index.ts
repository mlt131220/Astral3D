import * as DrawShare from "./drawShare";
import { useAddSignal, useDispatchSignal, useRemoveSignal } from "#/hooks";
import OffScreenCanvasWorker from './offScreenCanvas.worker.ts?worker&url';
import App from "#/core/app/App.ts";

/** ----------------- 离屏渲染中的事件处理--------------------------- **/
const mouseEventHandler = makeSendPropertiesHandler([
    'ctrlKey',
    'metaKey',
    'shiftKey',
    'button',
    'pointerType',
    'clientX',
    'clientY',
    'pageX',
    'pageY',
]);
const wheelEventHandlerImpl = makeSendPropertiesHandler([
    'deltaX',
    'deltaY',
]);
const keydownEventHandler = makeSendPropertiesHandler([
    'ctrlKey',
    'metaKey',
    'shiftKey',
    'keyCode',
]);
function wheelEventHandler(event, sendFn) {
    event.preventDefault();
    wheelEventHandlerImpl(event, sendFn);
}

function preventDefaultHandler(event) {
    event.preventDefault();
}

function copyProperties(src, properties, dst) {
    for (const name of properties) {
        dst[name] = src[name];
    }
}

function makeSendPropertiesHandler(properties) {
    return function sendProperties(event, sendFn) {
        const data = { type: event.type };
        copyProperties(event, properties, data);
        sendFn(data);
    };
}

function touchEventHandler(event, sendFn) {
    const touches: { pageX: number, pageY: number }[] = [];
    const data = { type: event.type, touches };
    for (let i = 0; i < event.touches.length; ++i) {
        const touch = event.touches[i];
        touches.push({
            pageX: touch.pageX,
            pageY: touch.pageY,
        });
    }

    sendFn(data);
}

// 四个方向键
const orbitKeys = {
    '37': true, // left
    '38': true, // up
    '39': true, // right
    '40': true, // down
};
function filteredKeydownEventHandler(event, sendFn) {
    const { keyCode } = event;
    if (orbitKeys[keyCode]) {
        event.preventDefault();
        keydownEventHandler(event, sendFn);
    }
}
/** ----------------- 离屏渲染中的事件end --------------------------- **/

let nextProxyId = 0;
/**
 * 转发 DOM 事件给Worker中的 ElementProxyReceiver
 */
class ElementProxy {
    readonly id: number;
    private worker: Worker;
    private element: HTMLElement;

    constructor(element, worker, eventHandlers) {
        this.id = nextProxyId++;
        this.worker = worker;
        this.element = element;

        // 注册一个响应元素id
        worker.postMessage({
            type: 'makeProxy',
            data: {
                id: this.id,
            }
        });

        this.sendSize();

        // 添加相应事件的监听
        for (const [eventName, handler] of Object.entries(eventHandlers)) {
            element.addEventListener(eventName, (event) => {
                // @ts-ignore
                handler(event, this.sendEvent.bind(this));
            });
        }
    }

    sendEvent(data) {
        this.worker.postMessage({
            type: 'event',
            data: {
                id: this.id,
                data,
            }
        });
    };

    sendSize() {
        const rect = this.element.getBoundingClientRect();
        this.sendEvent({
            type: 'size',
            left: rect.left,
            top: rect.top,
            width: this.element.clientWidth,
            height: this.element.clientHeight,
        });
    }
}

let cadDialogMoveFn;
/**
 * dxf对象的查看器类
 * @param {any} data - dxf对象
 * @param {HTMLCanvasElement} canvas - three 画布
 * @param {Number} width - 渲染画布的宽度，以像素为单位
 * @param {Number} height - 渲染画布的高度，以像素为单位
 * @constructor
 */
class DxfViewer {
    private worker: Worker | undefined;
    private resizeObserver: ResizeObserver;
    private proxy: ElementProxy | undefined;
    private middleObject: any = new Proxy({}, {
        set(target, p: string | symbol, newValue: any): boolean {
            target[p] = newValue;

            // switch (p) {
            //     case "markList":
            //         break;
            // }

            return true;
        }
    })

    constructor(data: any, canvas: HTMLCanvasElement, width: number, height: number, onComplete?: () => void) {
        //console.log('dxf data:', data);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const cadFontUrl = new URL(import.meta.env.BASE_URL + 'resource/fonts/Alimama_DongFangDaKai_Regular.ttf', import.meta.url).href;

        // 检查是否支持离屏canvas
        if (canvas.transferControlToOffscreen) {
            // console.log('OffscreenCanvas supported');
            // 创建Worker进行离屏渲染
            this.worker = new Worker(OffScreenCanvasWorker, { type: 'module' });
            const offscreen = canvas.transferControlToOffscreen();
            offscreen.width = width;
            offscreen.height = height;

            // 添加鼠标事件的监听
            const eventHandlers = {
                contextmenu: preventDefaultHandler,
                mousedown: mouseEventHandler,
                mousemove: mouseEventHandler,
                mouseup: mouseEventHandler,
                pointerdown: mouseEventHandler,
                pointermove: mouseEventHandler,
                pointerup: mouseEventHandler,
                touchstart: touchEventHandler,
                //touchmove: touchEventHandler,
                touchend: touchEventHandler,
                wheel: wheelEventHandler,
                keydown: filteredKeydownEventHandler,
            };
            this.proxy = new ElementProxy(canvas, this.worker, eventHandlers);

            this.worker.postMessage({
                type: 'start', data: {
                    canvas: offscreen,
                    canvasId: this.proxy.id,
                    data: data,
                    options: {
                        bgColor: 0x000000,
                        contrastColor: 0xffffff,
                        fontUrl: cadFontUrl
                    },
                    middleObject: {
                        markList: JSON.stringify(App.project.getKey("drawing.markList")),
                        selectedRectIndex: App.project.getKey("drawing.selectedRectIndex"),
                    }
                }
            }, [offscreen]);

            this.worker.onmessage = (event) => {
                const data = event.data;
                switch (data.type) {
                    case 'complete':
                        onComplete && onComplete();
                        break;
                    case "signal":
                        this.handleSignal(data.data)
                        break;
                    case "style":
                        canvas.style[data.data.key] = data.data.value;
                        break;
                    case "middle":
                        this.middleObject[data.data.key] = data.data.value;
                        break;
                }
            }

            cadDialogMoveFn = this.proxy.sendSize.bind(this.proxy);
            useAddSignal("cadViewerResize", cadDialogMoveFn)
        } else {
            canvas.width = width;
            canvas.height = height;

            //不支持离屏渲染
            DrawShare.main({
                canvas,
                inputElement: canvas,
                data: data,
                onComplete: onComplete,
                signal: this.handleSignal,
                options: {
                    bgColor: 0x000000,
                    contrastColor: 0xffffff,
                    fontUrl: cadFontUrl
                },
                middleObject: this.middleObject
            });
        }

        // 监听窗口变化
        this.resizeObserver = new ResizeObserver(entries => {
            canvas.style.width = `${entries[0].contentRect.width}px`;
            canvas.style.height = `${entries[0].contentRect.height}px`;

            const data = {
                width: entries[0].contentRect.width,
                height: entries[0].contentRect.height
            }

            if (this.worker) {
                this.worker.postMessage({
                    type: "resize",
                    data
                })

                this.proxy?.sendSize();
            } else {
                DrawShare.resize(data)
            }
        });
        this.resizeObserver.observe(canvas.parentElement as HTMLDivElement);
    }

    // 触发signal
    handleSignal(args) {
        const { type, name, data } = args;
        switch (type) {
            case "dispatch":
                useDispatchSignal(name, ...data)
                break;
        }
    }

    // 调用drawShare中的方法,data为传入的参数，对象展示
    callMethod(methodName: string, data: any = {}) {
        if (this.worker) {
            this.worker.postMessage({
                type: methodName,
                data,
            })
        } else {
            DrawShare[methodName](data);
        }
    }

    dispose() {
        if (this.worker) {
            this.worker.terminate();
            useRemoveSignal("cadViewerResize", cadDialogMoveFn)
        } else {
            DrawShare.dispose();
        }

        this.resizeObserver.disconnect();
    }

    /* ------------------- 需要共同实现的标记相关方法 ------------------------- */
    // 获取选中的标记
    get selectRectIndex() {
        return this.middleObject.selectRectIndex;
    }

    // 删除选中的标记
    deleteRect() {
        const id = this.middleObject.selectRect?.id;
        if (!id) return;

        const elementId = this.middleObject.selectRect?.elementId;
        this.callMethod('callModuleMethod', {
            moduleName: "drawRect", methodName: "deleteRect", elementId: elementId
        })
    }

    // 根据模型选中对应标记
    selectRect(uuid: string) {
        this.callMethod('callModuleMethod', {
            moduleName: "drawRect", methodName: "setSelect", elementId: uuid
        })
    }
}

export { DxfViewer }