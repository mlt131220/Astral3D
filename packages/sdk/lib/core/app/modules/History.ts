import type { Object3D } from 'three';
import * as Commands from '#/core/commands/Commands';
import { useSignal } from "#/hooks";
import App from "#/core/app/App";

const { dispatch: useDispathSignal, setActive } = useSignal();

interface Undos {
	id: number,
	name?: string,
	updatable: boolean,
	object: Object3D,
	type: string,
	script,
	attributeName: string,
	inMemory: boolean,
	json: string,
	update: (T) => void,
	toJSON: () => string,
	fromJSON: (string) => void,
	undo: () => void,
	execute: () => void,
}

class History {
	public undos: Array<Undos>;
	public redos: Array<Undos>;
	protected lastCmdTime: number;
	protected idCounter: number;

	constructor() {
		this.undos = [];
		this.redos = [];
		this.lastCmdTime = Date.now();
		this.idCounter = 0;
	}

	execute(cmd, optionalName) {
		const lastCmd = this.undos[this.undos.length - 1];
		const timeDifference = Date.now() - this.lastCmdTime;

		const isUpdatableCmd = lastCmd &&
			lastCmd.updatable &&
			cmd.updatable &&
			lastCmd.object === cmd.object &&
			lastCmd.type === cmd.type &&
			lastCmd.script === cmd.script &&
			lastCmd.attributeName === cmd.attributeName;

		if (isUpdatableCmd && cmd.type === 'SetScriptValueCommand') {
			// 当cmd.type为“SetScriptValueCommand”时，将忽略时间差异
			lastCmd.update(cmd);
			cmd = lastCmd;
		} else if (isUpdatableCmd && timeDifference < 500) {
			lastCmd.update(cmd);
			cmd = lastCmd;
		} else {
			// 该命令不可更新，并作为历史记录的新部分添加
			this.undos.push(cmd);
			cmd.id = ++this.idCounter;
		}

		cmd.name = (optionalName !== undefined) ? optionalName : cmd.name;
		cmd.execute();
		cmd.inMemory = true;

		if (App.config.getKey('history')) {
			//在执行后立即序列化cmd，并将json附加到cmd
			cmd.json = cmd.toJSON();
		}

		this.lastCmdTime = Date.now();

		// 清除所有redo命令
		this.redos = [];
		useDispathSignal("historyChanged", cmd);
	}

	undo() {
		let cmd: Undos | undefined = undefined;
		if (this.undos.length > 0) {
			cmd = this.undos.pop() as Undos;
			if (cmd.inMemory === false) {
				cmd.fromJSON(cmd.json);
			}
		}

		if (cmd !== undefined) {
			cmd.undo();
			this.redos.push(cmd);
			useDispathSignal("historyChanged", cmd);
		}
		return cmd;
	}

	redo(): Undos | undefined {
		let cmd: Undos | undefined = undefined;
		if (this.redos.length > 0) {
			cmd = this.redos.pop() as Undos;
			if (cmd.inMemory === false) {
				cmd.fromJSON(cmd.json);
			}
		}

		if (cmd !== undefined) {
			cmd.execute();
			this.undos.push(cmd);
			useDispathSignal("historyChanged", cmd);
		}

		return cmd;
	}

	toJSON() {
		const history: { undos?: Array<string>, redos?: Array<string> } = {};
		history.undos = [];
		history.redos = [];
		if (!App.config.getKey('history')) return history;

		//将Undos附加到历史记录
		for (let i = 0; i < this.undos.length; i++) {
			if (this.undos[i].hasOwnProperty('json')) {
				history.undos.push(this.undos[i].json);
			}
		}

		//将Redos附加到历史记录
		for (let i = 0; i < this.redos.length; i++) {
			if (this.redos[i].hasOwnProperty('json')) {
				history.redos.push(this.redos[i].json);
			}
		}
		return history;
	}

	fromJSON(json) {
		if (json === undefined) return;

		for (let i = 0; i < json.undos.length; i++) {
			const cmdJSON = json.undos[i];
			//创建一个类型为"json.type"的新对象
			const cmd = new Commands[cmdJSON.type](App);
			cmd.json = cmdJSON;
			cmd.id = cmdJSON.id;
			cmd.name = cmdJSON.name;
			this.undos.push(cmd);
			//设置最后使用的idCounter
			this.idCounter = (cmdJSON.id > this.idCounter) ? cmdJSON.id : this.idCounter;
		}

		for (let i = 0; i < json.redos.length; i++) {
			const cmdJSON = json.redos[i];
			const cmd = new Commands[cmdJSON.type](App);
			cmd.json = cmdJSON;
			cmd.id = cmdJSON.id;
			cmd.name = cmdJSON.name;
			this.redos.push(cmd);
			this.idCounter = (cmdJSON.id > this.idCounter) ? cmdJSON.id : this.idCounter;
		}

		// 选择最后执行的undo命令
		useDispathSignal("historyChanged", this.undos[this.undos.length - 1]);
	}

	clear() {
		this.undos = [];
		this.redos = [];
		this.idCounter = 0;

		useDispathSignal("historyChanged");
	}

	goToState(id: number) {
		setActive("sceneGraphChanged", false);
		setActive("historyChanged", false);

		//下一个弹出的CMD
		let cmd: Undos | undefined = this.undos.length > 0 ? this.undos[this.undos.length - 1] : undefined;
		if (cmd === undefined || id > cmd.id) {
			cmd = this.redo();
			while (cmd !== undefined && id > cmd.id) {
				cmd = this.redo();
			}
		} else {
			while (true) {
				cmd = this.undos[this.undos.length - 1];
				if (cmd === undefined || id === cmd.id) break;
				this.undo();
			}
		}

		setActive("sceneGraphChanged", true);
		setActive("historyChanged", true);

		useDispathSignal("sceneGraphChanged");
		useDispathSignal("historyChanged", cmd);
	}

	enableSerialization(id) {
		/**
		 * 因为可能有命令在 this.undos && this.redos
		 * 没有被.toJSON()序列化的，我们返回
		 */
		this.goToState(-1);

		setActive("sceneGraphChanged", false);
		setActive("historyChanged", false);

		let cmd: Undos | undefined = this.redo();
		while (cmd !== undefined) {
			if (!cmd.hasOwnProperty('json')) {
				cmd.json = cmd.toJSON();
			}
			cmd = this.redo();
		}

		setActive("sceneGraphChanged", true);
		setActive("historyChanged", true);

		this.goToState(id);
	}
}

export { History };
