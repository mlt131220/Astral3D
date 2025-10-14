import { Command } from './Command';
import { useDispatchSignal } from "#/hooks";
import App from "../app/App";

/**
 * @param object THREE.Object3D
 * @param newValue string
 * @constructor
 */
class SetUuidCommand extends Command {
	public object;
	public oldValue;
	public newValue;

	constructor(object, newValue) {
		super();

		this.type = 'SetUuidCommand';
		this.name = `Update uuid`;

		this.object = object;

		this.oldValue = (object !== undefined) ? object.uuid : undefined;
		this.newValue = newValue;

	}

	execute() {
		this.object.uuid = this.newValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	undo() {
		this.object.uuid = this.oldValue;
		useDispatchSignal("objectChanged", this.object);
		useDispatchSignal("sceneGraphChanged");
	}

	toJSON() {
		const output = super.toJSON();
		output.oldValue = this.oldValue;
		output.newValue = this.newValue;

		return output;
	}

	fromJSON(json) {
		super.fromJSON(json);

		this.oldValue = json.oldValue;
		this.newValue = json.newValue;
		this.object = App.getObjectByUuid(json.oldValue);

		if (this.object === undefined) {
			this.object = App.getObjectByUuid(json.newValue);
		}
	}
}

export { SetUuidCommand };
