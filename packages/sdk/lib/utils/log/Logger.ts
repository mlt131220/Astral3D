/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/2/24 下午2:21
 * @description 日志记录器
 */
import { useAddSignal, useDispatchSignal, useRemoveSignal } from '#/hooks';

export interface ILog {
    id: number;
    message: string;
    time: string;
    level: string;
}

let _delLogFn, _clearLogFn, _historyChangedFn;
class Logger {
    static Enum = Object.freeze({
        TRACE: "trace",
        DEBUG: "debug",
        INFO: "info",
        WARN: "warn",
        ERROR: "error"
    });

    // 是否启用日志
    enabled: boolean = true;

    // 日志信息
    logs: ILog[] = [];

    constructor() {
        _delLogFn = this.delLog.bind(this);
        useAddSignal("deleteLog", _delLogFn);
        _clearLogFn = this.clearLogs.bind(this);
        useAddSignal("clearLogs", _clearLogFn);
        _historyChangedFn = this.historyChanged.bind(this);
        useAddSignal("historyChanged", _historyChangedFn);
    }

    log(methodName: string, message: string) {
        if (!this.enabled) return;

        const _log = {
            id: this.logs.length,
            message,
            level: methodName,
            time: new Date().toLocaleString()
        }

        this.logs.unshift(_log);

        useDispatchSignal("addLog", _log, this.logs);
    }

    trace(message: string) { this.log(Logger.Enum.TRACE, message); }
    debug(message: string) { this.log(Logger.Enum.DEBUG, message); }
    info(message: string) { this.log(Logger.Enum.INFO, message); }
    warn(message: string) { this.log(Logger.Enum.WARN, message); }
    error(message: string) { this.log(Logger.Enum.ERROR, message); }

    /**
     * 删除日志
     * @param _log
     */
    delLog(_log: ILog) {
        this.logs = this.logs.filter(log => log.id !== _log.id);
    }

    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
    }

    /**
     * 历史记录变化回调
     * @param cmd
     */
    historyChanged(cmd) {
        if (!cmd?.name) return;

        let msg = cmd.name;
        const postposition = ['AddObjectCommand', 'RemoveObjectCommand', 'MoveObjectCommand'];
        if (postposition.includes(cmd.type)) {
            msg = `${msg}: ${cmd.object.name} `;
        } else if (cmd.object) {
            msg = `${cmd.object.name} ${msg.toLowerCase()}`;
        }

        if (cmd.newValue !== undefined && cmd.oldValue !== undefined) {
            let newValue = cmd.newValue;
            let oldValue = cmd.oldValue;
            if (typeof newValue === 'object') {
                newValue = JSON.stringify(newValue);
            }
            if (typeof oldValue === 'object') {
                oldValue = JSON.stringify(oldValue);
            }

            msg = `${msg}: ${oldValue} ⇒ ${newValue}`;
        }

        this.info(msg);
    }

    dispose() {
        useRemoveSignal("deleteLog", _delLogFn)
        _delLogFn = null;
        useRemoveSignal("clearLogs", _clearLogFn)
        _clearLogFn = null;
        useRemoveSignal("historyChanged", _historyChangedFn)
        _historyChangedFn = null;
    }
}

export const logger = new Logger();

export default logger;