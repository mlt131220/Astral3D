import { Object3D } from "three";
import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param script javascript object
 * @constructor
 */
class AddScriptCommand extends Command {
	private object: Object3D;
	private script: any;

	constructor(object: Object3D, script) {
		super();

		this.type = 'AddScriptCommand';
		this.name = 'Add script';

		this.object = object;
		this.script = script;
	}

	execute() {
		if (App.scripts[this.object.uuid] === undefined) {
			App.scripts[this.object.uuid] = [];
		}

		App.scripts[this.object.uuid].push(this.script);

		useDispatchSignal("scriptAdded", this.object, this.script);
	}

	undo() {
		if (App.scripts[this.object.uuid] === undefined) return;

		const index = App.scripts[this.object.uuid].indexOf(this.script);

		if (index !== -1) {
			App.scripts[this.object.uuid].splice(index, 1);
		}

		useDispatchSignal("scriptRemoved", this.object, this.script);
	}

	toJSON() {
		const output = super.toJSON();

		output.objectUuid = this.object.uuid;
		output.script = this.script;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.script = json.script;
		this.object = App.getObjectByUuid(json.objectUuid) as Object3D;
	}
}

export { AddScriptCommand };
