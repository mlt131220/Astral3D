<script lang="ts" setup>
import { ref, reactive, onMounted,onBeforeUnmount } from "vue";
import * as THREE from "three";
import { App,Hooks,Utils,SetValueCommand,SetPositionCommand,SetRotationCommand,SetScaleCommand,SetColorCommand } from "@astral3d/engine";
import EsInputNumber from '@/components/es/EsInputNumber.vue';
import { t } from "@/language";
import UserData from "@/components/code/UserData.vue";
import EsKeyFrame from "@/components/es/EsKeyFrame.vue";

const isSelectObject3D = ref(false);
const objectData = reactive({
    type: "",
    uuid: "",
    name: "",
    position: {
        x: 0,
        y: 0,
        z: 0
    },
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    scale: {
        x: 1,
        y: 1,
        z: 1
    },
    fov: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    near: 0,
    far: 0,
    intensity: 0,
    color: "",
    groundColor: "",
    distance: 0,
    angle: 0,
    penumbra: 0,
    decay: 0,
    castShadow: false,
    receiveShadow: false,
    shadow: {
        bias: 0,
        normalBias: 0,
        radius: 1,
        intensity: 1
    },
    visible: true,
    frustumCulled: true,
    renderOrder: 0,
    userData: "{}"
})
const transformRowsVisible = reactive({
    rotation: true,
    scale: true
})
const objectDataVisible = reactive({
    fov: true,
    left: true,
    right: true,
    top: true,
    bottom: true,
    near: true,
    far: true,
    intensity: true,
    color: true,
    groundColor: true,
    distance: true,
    angle: true,
    penumbra: true,
    decay: true,
    castShadow: true,
    receiveShadow: true,
    shadow: true
})

onMounted(() => {
  Hooks.useAddSignal("objectSelected",handleSelectObject3D);
  Hooks.useAddSignal("objectChanged", handleObjectChange);
})
onBeforeUnmount(() => {
  Hooks.useRemoveSignal("objectSelected",handleSelectObject3D);
  Hooks.useRemoveSignal("objectChanged", handleObjectChange)
})

function handleSelectObject3D(object){
  if (object !== null) {
    isSelectObject3D.value = true;
    updateRows(object);
    updateUI(object);
  } else {
    isSelectObject3D.value = false;
  }
}

function handleObjectChange(object){
  if (object !== App.selected) return;
  updateUI(object);
}

function updateRows(object) {
    for (const property in objectDataVisible) {
        objectDataVisible[property] = object[property] !== undefined;
    }

    if (object.isLight) {
        objectDataVisible.receiveShadow = false;
    }

    if (object.isAmbientLight || object.isHemisphereLight) {
        objectDataVisible.castShadow = false;
    }
}

const updateUI = Utils.throttle(function(object) {
    objectData.type = object.type;
    objectData.uuid = object.uuid;
    objectData.name = object.name;
    objectData.position.x = Number(object.position.x.toFixed(3));
    objectData.position.y = Number(object.position.y.toFixed(3));
    objectData.position.z = Number(object.position.z.toFixed(3));
    objectData.rotation.x = Number((object.rotation.x * THREE.MathUtils.RAD2DEG).toFixed(3));
    objectData.rotation.y = Number((object.rotation.y * THREE.MathUtils.RAD2DEG).toFixed(3));
    objectData.rotation.z = Number((object.rotation.z * THREE.MathUtils.RAD2DEG).toFixed(3));
    objectData.scale.x = Number(object.scale.x.toFixed(3));
    objectData.scale.y = Number(object.scale.y.toFixed(3));
    objectData.scale.z = Number(object.scale.z.toFixed(3));

    if (object.fov !== undefined) {
        objectData.fov = object.fov;
    }
    if (object.left !== undefined) {
        objectData.left = object.left;
    }
    if (object.right !== undefined) {
        objectData.right = object.right;
    }
    if (object.top !== undefined) {
        objectData.top = object.top;
    }
    if (object.bottom !== undefined) {
        objectData.bottom = object.bottom;
    }
    if (object.near !== undefined) {
        objectData.near = object.near;
    }
    if (object.far !== undefined) {
        objectData.far = object.far;
    }
    if (object.intensity !== undefined) {
        objectData.intensity = object.intensity;
    }
    if (object.color !== undefined) {
        objectData.color = object.color.getStyle();
    }
    if (object.groundColor !== undefined) {
        objectData.groundColor = object.groundColor.getStyle();
    }
    if (object.distance !== undefined) {
        objectData.distance = object.distance;
    }
    if (object.angle !== undefined) {
        objectData.angle = object.angle;
    }
    if (object.penumbra !== undefined) {
        objectData.penumbra = object.penumbra;
    }
    if (object.decay !== undefined) {
        objectData.decay = object.decay;
    }
    if (object.castShadow !== undefined) {
        objectData.castShadow = object.castShadow;
    }
    if (object.receiveShadow !== undefined) {
        objectData.receiveShadow = object.receiveShadow;
    }
    if (object.shadow !== undefined) {
        objectData.shadow.bias = object.shadow.bias;
        objectData.shadow.normalBias = object.shadow.normalBias;
        objectData.shadow.radius = object.shadow.radius;
        objectData.shadow.intensity = object.shadow.intensity;
    }

    objectData.visible = object.visible;
    objectData.frustumCulled = object.frustumCulled;
    objectData.renderOrder = object.renderOrder;

    try {
        objectData.userData = JSON.stringify(object.userData, null, '  ');
    } catch (error) {
        console.log(error);
    }

    updateTransformRows(object);
},100)

function updateTransformRows(object) {
    if (object.isLight || (object.isObject3D && object.userData.targetInverse)) {
        transformRowsVisible.rotation = false;
        transformRowsVisible.scale = false;
    } else {
        transformRowsVisible.rotation = true;
        transformRowsVisible.scale = true;
    }
}

const update = (method: string) => {
    const object = App.selected as any;
    if (object === null) return;

    const call = {
        name: () => {
            App.execute(new SetValueCommand(object, 'name', objectData.name));
            Hooks.useDispatchSignal("sceneTreeChange");
        },
        position: () => {
            const newPosition = new THREE.Vector3(objectData.position.x, objectData.position.y, objectData.position.z);
            if (object.position.distanceTo(newPosition) >= 0.01) {
                App.execute(new SetPositionCommand(object, newPosition));
            }
        },
        rotation: () => {
            const newRotation = new THREE.Euler(objectData.rotation.x * THREE.MathUtils.DEG2RAD, objectData.rotation.y * THREE.MathUtils.DEG2RAD, objectData.rotation.z * THREE.MathUtils.DEG2RAD);
            if (new THREE.Vector3().setFromEuler(object.rotation).distanceTo(new THREE.Vector3().setFromEuler(newRotation)) >= 0.01) {
                App.execute(new SetRotationCommand(object, newRotation, undefined));
            }
        },
        scale: () => {
            const newScale = new THREE.Vector3(objectData.scale.x, objectData.scale.y, objectData.scale.z);
            if (object.scale.distanceTo(newScale) >= 0.01) {
                App.execute(new SetScaleCommand(object, newScale, undefined));
            }
        },
        fov: () => {
            if (object.fov !== undefined && Math.abs(object.fov - objectData.fov) >= 0.01) {
                App.execute(new SetValueCommand(object, 'fov', objectData.fov));
                object.updateProjectionMatrix();
            }
        },
        left: () => {
            if (object.left !== undefined && Math.abs(object.left - objectData.left) >= 0.01) {
                App.execute(new SetValueCommand(object, 'left', objectData.left));
                object.updateProjectionMatrix();
            }
        },
        right: () => {
            if (object.right !== undefined && Math.abs(object.right - objectData.right) >= 0.01) {
                App.execute(new SetValueCommand(object, 'right', objectData.right));
                object.updateProjectionMatrix();
            }
        },
        top: () => {
            if (object.top !== undefined && Math.abs(object.top - objectData.top) >= 0.01) {
                App.execute(new SetValueCommand(object, 'top', objectData.top));
                object.updateProjectionMatrix();
            }
        },
        bottom: () => {
            if (object.bottom !== undefined && Math.abs(object.bottom - objectData.bottom) >= 0.01) {
                App.execute(new SetValueCommand(object, 'bottom', objectData.bottom));
                object.updateProjectionMatrix();
            }
        },
        near: () => {
            if (object.near !== undefined && Math.abs(object.near - objectData.near) >= 0.01) {
                App.execute(new SetValueCommand(object, 'near', objectData.near));
                if (object.isOrthographicCamera) {
                    object.updateProjectionMatrix();
                }
            }
        },
        far: () => {
            if (object.far !== undefined && Math.abs(object.far - objectData.far) >= 0.01) {
                App.execute(new SetValueCommand(object, 'far', objectData.far));
                if (object.isOrthographicCamera) {
                    object.updateProjectionMatrix();
                }
            }
        },
        intensity: () => {
            if (object.intensity !== undefined && Math.abs(object.intensity - objectData.intensity) >= 0.01) {
                App.execute(new SetValueCommand(object, 'intensity', objectData.intensity));
            }
        },
        color: () => {
            if (object.color !== undefined && object.color.getHex() !== objectData.color) {
                App.execute(new SetColorCommand(object, 'color', objectData.color));
            }
        },
        groundColor: () => {
            if (object.groundColor !== undefined && object.groundColor.getHex() !== objectData.groundColor) {
                App.execute(new SetColorCommand(object, 'groundColor', objectData.groundColor));
            }
        },
        distance: () => {
            if (object.distance !== undefined && Math.abs(object.distance - objectData.distance) >= 0.01) {
                App.execute(new SetValueCommand(object, 'distance', objectData.distance));
            }
        },
        angle: () => {
            if (object.angle !== undefined && Math.abs(object.angle - objectData.angle) >= 0.01) {
                App.execute(new SetValueCommand(object, 'angle', objectData.angle));
            }
        },
        penumbra: () => {
            if (object.penumbra !== undefined && Math.abs(object.penumbra - objectData.penumbra) >= 0.01) {
                App.execute(new SetValueCommand(object, 'penumbra', objectData.penumbra));
            }
        },
        decay: () => {
            if (object.decay !== undefined && Math.abs(object.decay - objectData.decay) >= 0.01) {
                App.execute(new SetValueCommand(object, 'decay', objectData.decay));
            }
        },
        castShadow: () => {
            if (object.castShadow !== undefined && object.castShadow !== objectData.castShadow) {
                App.execute(new SetValueCommand(object, 'castShadow', objectData.castShadow));
            }
        },
        receiveShadow: () => {
            if (object.receiveShadow !== objectData.receiveShadow) {
                if (object.material !== undefined) object.material.needsUpdate = true;
                App.execute(new SetValueCommand(object, 'receiveShadow', objectData.receiveShadow));
            }
        },
        shadowBias: () => {
            if (object.shadow !== undefined && object.shadow.bias !== objectData.shadow.bias) {
                App.execute(new SetValueCommand(object.shadow, 'bias', objectData.shadow.bias));
            }
        },
        shadowNormalBias: () => {
            if (object.shadow !== undefined && object.shadow.normalBias !== objectData.shadow.normalBias) {
                App.execute(new SetValueCommand(object.shadow, 'normalBias', objectData.shadow.normalBias));
            }
        },
        shadowRadius: () => {
            if (object.shadow !== undefined && object.shadow.radius !== objectData.shadow.radius) {
                App.execute(new SetValueCommand(object.shadow, 'radius', objectData.shadow.radius));
            }
        },
        shadowIntensity: () => {
            if (object.shadow !== undefined && object.shadow.intensity !== objectData.shadow.intensity) {
                App.execute(new SetValueCommand(object.shadow, 'intensity', objectData.shadow.intensity));
            }
        },
        visible: () => {
            if (object.visible !== objectData.visible) {
                App.execute(new SetValueCommand(object, 'visible', objectData.visible));
            }
        },
        frustumCulled: () => {
            if (object.frustumCulled !== objectData.frustumCulled) {
                App.execute(new SetValueCommand(object, 'frustumCulled', objectData.frustumCulled));
            }
        },
        renderOrder: () => {
            if (object.renderOrder !== objectData.renderOrder) {
                App.execute(new SetValueCommand(object, 'renderOrder', objectData.renderOrder));
            }
        },
        userData: () => {
            try {
                const userData = JSON.parse(objectData.userData);
                if (JSON.stringify(object.userData) != JSON.stringify(userData)) {
                    App.execute(new SetValueCommand(object, 'userData', userData));
                }
            } catch (exception) {
                console.warn(exception);
            }
        }
    }

    call[method]();
}

const userDataStatus = ref<any>(undefined);
const userDataEditorShow = ref(false);
const handleUserDataClick = () => {
    // try {
    //   JSON.parse(objectData.userData);
    //   userDataStatus.value = 'success';
    // } catch (error) {
    //   userDataStatus.value = 'error';
    // }
    userDataEditorShow.value = true;
}
</script>

<template>
    <div id="sider-scene-attr" v-if="isSelectObject3D">
        <!-- type -->
        <div class="sider-scene-attr-item">
            <span>{{ t("layout.sider.object.type") }}</span>
            <div>{{ objectData.type }}</div>
        </div>
        <!-- uuid -->
        <div class="sider-scene-attr-item">
            <span>{{ t("layout.sider.object.uuid") }}</span>
            <div class="flex items-center">
                <n-tooltip trigger="hover">
                    <template #trigger>
                        <span class="uuid">{{ objectData.uuid }}</span>
                    </template>
                    {{ objectData.uuid }}
                </n-tooltip>
            </div>
        </div>
        <!-- name -->
        <div class="sider-scene-attr-item">
            <span>{{ t("layout.sider.object.name") }}</span>
            <div>
                <n-input v-model:value="objectData.name" type="text" size="small" @update:value="update('name')" />
            </div>
        </div>
        <!-- position -->
        <div class="sider-scene-attr-item">
            <EsKeyFrame :label="t('layout.sider.object.position')" attr="position" />
            <div class="flex">
                <EsInputNumber v-model:value="objectData.position.x" size="tiny" :show-button="false" :decimal="3" :step="1"
                    @change="update('position')" />
                <EsInputNumber v-model:value="objectData.position.y" size="tiny" :show-button="false" :decimal="3" :step="1"
                    @change="update('position')" />
                <EsInputNumber v-model:value="objectData.position.z" size="tiny" :show-button="false" :decimal="3" :step="1"
                    @change="update('position')" />
            </div>
        </div>
        <!-- rotation -->
        <div class="sider-scene-attr-item" v-if="transformRowsVisible.rotation">
            <EsKeyFrame :label="t('layout.sider.object.rotation')" attr="quaternion" />
            <div class="flex">
                <EsInputNumber v-model:value="objectData.rotation.x" size="tiny" :decimal="2" :step="1" :show-button="false"
                    @change="update('rotation')" unit="°" />
                <EsInputNumber v-model:value="objectData.rotation.y" size="tiny" :decimal="2" :step="1" :show-button="false"
                    @change="update('rotation')" unit="°" />
                <EsInputNumber v-model:value="objectData.rotation.z" size="tiny" :decimal="2" :step="1" :show-button="false"
                    @change="update('rotation')" unit="°" />
            </div>
        </div>
        <!-- scale -->
        <div class="sider-scene-attr-item" v-if="transformRowsVisible.scale">
            <EsKeyFrame :label="t('layout.sider.object.scale')" attr="scale" />
            <div class="flex">
                <EsInputNumber v-model:value="objectData.scale.x" size="tiny" :decimal="3" :step="1" :show-button="false"
                    @change="update('scale')" />
                <EsInputNumber v-model:value="objectData.scale.y" size="tiny" :decimal="3" :step="1" :show-button="false"
                    @change="update('scale')" />
                <EsInputNumber v-model:value="objectData.scale.z" size="tiny" :decimal="3" :step="1" :show-button="false"
                    @change="update('scale')" />
            </div>
        </div>
        <!-- fov -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.fov">
            <EsKeyFrame :label="t('layout.sider.object.fov')" attr="fov" />
            <div>
                <EsInputNumber v-model:value="objectData.fov" size="tiny" :decimal="2" :show-button="false"
                    @change="update('fov')" />
            </div>
        </div>
        <!-- left -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.left">
            <span>{{ t("layout.sider.object.left") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.left" size="tiny" :show-button="false"
                    @change="update('left')" />
            </div>
        </div>
        <!-- right -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.right">
            <span>{{ t("layout.sider.object.right") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.right" size="tiny" :show-button="false"
                    @change="update('right')" />
            </div>
        </div>
        <!-- top -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.top">
            <span>{{ t("layout.sider.object.top") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.top" size="tiny" :show-button="false"
                    @change="update('top')" />
            </div>
        </div>
        <!-- bottom -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.bottom">
            <span>{{ t("layout.sider.object.bottom") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.bottom" size="tiny" :show-button="false"
                    @change="update('bottom')" />
            </div>
        </div>
        <!-- near -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.near">
            <EsKeyFrame :label="t('layout.sider.object.near')" attr="near" />
            <div>
                <EsInputNumber v-model:value="objectData.near" size="tiny" :decimal="2" :min="0" :show-button="false"
                    @change="update('near')" />
            </div>
        </div>
        <!-- far -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.far">
            <EsKeyFrame :label="t('layout.sider.object.far')" attr="far" />
            <div>
                <EsInputNumber v-model:value="objectData.far" size="tiny" :decimal="2" :show-button="false"
                    @change="update('far')" />
            </div>
        </div>
        <!-- intensity -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.intensity">
            <EsKeyFrame :label="t('layout.sider.object.intensity')" attr="intensity" />
            <div>
                <EsInputNumber v-model:value="objectData.intensity" size="tiny" :min="0" :show-button="false"
                    @change="update('intensity')" />
            </div>
        </div>
        <!-- color -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.color">
            <EsKeyFrame :label="t('layout.sider.object.color')" attr="color" />
            <div>
                <n-color-picker v-model:value="objectData.color" :show-alpha="false" size="small"
                    @update:value="update('color')" />
            </div>
        </div>
        <!-- groundcolor -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.groundColor">
            <EsKeyFrame :label="t('layout.sider.object.groundcolor')" attr="groundcolor" />
            <div>
                <n-color-picker v-model:value="objectData.groundColor" :modes="['hex']" :show-alpha="false" size="small"
                    @update:value="update('groundColor')" />
            </div>
        </div>
        <!-- distance -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.distance">
            <EsKeyFrame :label="t('layout.sider.object.distance')" attr="distance" />
            <div>
                <EsInputNumber v-model:value="objectData.distance" size="tiny" :min="0" :show-button="false"
                    @change="update('distance')" />
            </div>
        </div>
        <!-- angle -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.angle">
            <span>{{ t("layout.sider.object.angle") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.angle" size="tiny" :min="0" :max="Math.PI / 2"
                    :show-button="false" :decimal="3" @change="update('angle')" />
            </div>
        </div>
        <!-- penumbra -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.penumbra">
            <span>{{ t("layout.sider.object.penumbra") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.penumbra" size="tiny" :min="0" :max="1" :show-button="false"
                    :decimal="2" @change="update('penumbra')" />
            </div>
        </div>
        <!-- decay -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.decay">
            <span>{{ t("layout.sider.object.decay") }}</span>
            <div>
                <EsInputNumber v-model:value="objectData.decay" size="tiny" :min="0" :max="Infinity"
                    :show-button="false" @change="update('decay')" />
            </div>
        </div>
        <!-- shadow -->
        <div class="sider-scene-attr-item" v-if="objectDataVisible.castShadow">
            <span>{{ t("layout.sider.object.shadow") }}</span>
            <div>
                <n-checkbox v-model:checked="objectData.castShadow"
                    @update:checked="update('castShadow')">{{ t("layout.sider.object.cast") }}
                </n-checkbox>
                <n-checkbox v-model:checked="objectData.receiveShadow" @update:checked="update('receiveShadow')"
                    v-if="objectDataVisible.receiveShadow">
                    {{ t("layout.sider.object.receive") }}
                </n-checkbox>
            </div>
        </div>

        <template v-if="objectDataVisible.shadow">
            <!-- shadowIntensity -->
            <div class="sider-scene-attr-item">
                <span>{{ t("layout.sider.object.shadowIntensity") }}</span>
                <div>
                    <EsInputNumber v-model:value="objectData.shadow.intensity" size="tiny" :show-button="false" :min="0"
                        :decimal="2" @change="update('shadowIntensity')" />
                </div>
            </div>
            <!-- shadowBias -->
            <div class="sider-scene-attr-item">
                <span>{{ t("layout.sider.object.shadowBias") }}</span>
                <div>
                    <EsInputNumber v-model:value="objectData.shadow.bias" size="tiny" :show-button="false" :decimal="4"
                        @change="update('shadowBias')" />
                </div>
            </div>
            <!-- shadowNormalBias -->
            <div class="sider-scene-attr-item">
                <span>{{ t("layout.sider.object.shadowNormalBias") }}</span>
                <div>
                    <EsInputNumber v-model:value="objectData.shadow.normalBias" size="tiny" :show-button="false"
                        @change="update('shadowNormalBias')" />
                </div>
            </div>
            <!-- shadowRadius -->
            <div class="sider-scene-attr-item">
                <span>{{ t("layout.sider.object.shadowRadius") }}</span>
                <div>
                    <EsInputNumber v-model:value="objectData.shadow.radius" size="tiny" :min="0" :show-button="false"
                        @change="update('shadowRadius')" />
                </div>
            </div>
        </template>

        <!-- visible -->
        <div class="sider-scene-attr-item">
            <EsKeyFrame :label="t('layout.sider.object.visible')" attr="visible" />
            <div>
                <n-checkbox v-model:checked="objectData.visible" @update:checked="update('visible')" />
            </div>
        </div>
        <!-- frustumcull -->
        <div class="sider-scene-attr-item">
            <span>{{ t("layout.sider.object.frustumcull") }}</span>
            <div>
                <n-checkbox v-model:checked="objectData.frustumCulled" @update:checked="update('frustumCulled')" />
            </div>
        </div>
        <!-- renderorder -->
        <div class="sider-scene-attr-item">
            <EsKeyFrame :label="t('layout.sider.object.renderorder')" attr="renderOrder" />
            <div>
                <EsInputNumber v-model:value="objectData.renderOrder" size="tiny" :show-button="false"
                    @change="update('renderOrder')" />
            </div>
        </div>
        <!-- userdata -->
        <div class="sider-scene-attr-item">
            <span>{{ t("layout.sider.object.userdata") }}</span>
            <div>
                <n-input type="textarea" :value="objectData.userData" round :rows="5" readonly :status="userDataStatus"
                    @click.stop="handleUserDataClick" />
            </div>
        </div>

        <UserData v-model:show="userDataEditorShow" @update:show="(s) => userDataEditorShow = s"
            v-model:value="objectData.userData" @update:value="update('userData')" />
    </div>
    <n-result v-else status="418" title="Empty" :description="t('prompt[\'No object selected.\']')" />
</template>

<style lang="less" scoped>
#sider-scene-attr {
    .sider-scene-attr-item {
        display: flex;
        justify-content: space-between;
        margin: 10px 0;
        align-items: center;

        &>span {
            min-width: 80px;
        }

        &>div {
            width: 150px;
            color: rgb(165, 164, 164);
            overflow: hidden;

            .uuid {
                width: 100%;
                white-space: nowrap;
                overflow-x: auto;
                display: inline-block;
            }
        }
    }
}

:deep(.n-input__textarea) {
    font-size: 12px;
}
</style>
