import { Scene } from "three";
import { Command } from './Command';
import { SetUuidCommand } from './SetUuidCommand';
import { SetValueCommand } from './SetValueCommand';
import { AddObjectCommand } from './AddObjectCommand';
import { useSignal } from "#/hooks";
import App from "../app/App";

const { setActive, dispatch } = useSignal();

/**
 * @param scene containing children to import
 * @constructor
 */
class SetSceneCommand extends Command {
	private cmdArray: any[];
	constructor(scene: Scene) {
		super();

		this.type = 'SetSceneCommand';
		this.name = 'Set scene';

		this.cmdArray = [];

		if (scene !== undefined) {
			this.cmdArray.push(new SetUuidCommand(App.scene, scene.uuid));
			this.cmdArray.push(new SetValueCommand(App.scene, 'name', scene.name));
			this.cmdArray.push(new SetValueCommand(App.scene, 'userData', JSON.parse(JSON.stringify(scene.userData))));

			while (scene.children.length > 0) {
				const child = scene.children.pop();
				this.cmdArray.push(new AddObjectCommand(child));
			}
		}
	}

	execute() {
		setActive("sceneGraphChanged", false);

		for (let i = 0; i < this.cmdArray.length; i++) {
			this.cmdArray[i].execute();
		}

		setActive("sceneGraphChanged", true);
		dispatch("sceneGraphChanged");
	}

	undo() {
		setActive("sceneGraphChanged", false);

		for (let i = this.cmdArray.length - 1; i >= 0; i--) {
			this.cmdArray[i].undo();
		}

		setActive("sceneGraphChanged", true);
		dispatch("sceneGraphChanged");
	}

	toJSON() {
		const output = super.toJSON();

		const cmds: string[] = [];
		for (let i = 0; i < this.cmdArray.length; i++) {
			cmds.push(this.cmdArray[i].toJSON());
		}

		output.cmds = cmds;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		const cmds = json.cmds;
		for (let i = 0; i < cmds.length; i++) {
			// @ts-ignore
			const cmd = new window[cmds[i].type]();	// 创建类型为“json.type”的新对象
			cmd.fromJSON(cmds[i]);
			this.cmdArray.push(cmd);
		}
	}
}

export { SetSceneCommand };
