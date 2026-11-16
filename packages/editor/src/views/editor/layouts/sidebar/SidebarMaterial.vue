<script lang="ts" setup>
import {ref, reactive, onMounted, onBeforeUnmount} from "vue";
import * as THREE from 'three';
import {App,Hooks,SetMaterialValueCommand,SetMaterialCommand,Utils} from "@astral3d/engine";
import {t} from "@/language";
import SceneAllMaterials from "./material/SceneAllMaterials.vue";
import SidebarMaterialProgram from "./material/SidebarMaterialProgram.vue";
import SidebarMaterialColorProperty from "./material/SidebarMaterialColorProperty.vue";
import SidebarMaterialNumberProperty from "./material/SidebarMaterialNumberProperty.vue";
import SidebarMaterialBooleanProperty from "./material/SidebarMaterialBooleanProperty.vue";
import SidebarMaterialConstantProperty from "./material/SidebarMaterialConstantProperty.vue";
import SidebarMaterialMapProperty from "./material/SidebarMaterialMapProperty.vue";
import UserData from "@/components/code/UserData.vue";

const hasMaterial = ref(false);
const objectData = reactive({
  slot: 0,
  type: "",
  uuid: "",
  name: "",
  userData: ""
})
const slotOptions = ref<Array<{ label: string, value: number }>>([]);
const typeOptions = ref<Array<{ label: string, value: string }>>([]);
const materialClasses = {
  'LineBasicMaterial': THREE.LineBasicMaterial,
  'LineDashedMaterial': THREE.LineDashedMaterial,
  'MeshBasicMaterial': THREE.MeshBasicMaterial,
  'MeshDepthMaterial': THREE.MeshDepthMaterial,
  'MeshNormalMaterial': THREE.MeshNormalMaterial,
  'MeshLambertMaterial': THREE.MeshLambertMaterial,
  'MeshMatcapMaterial': THREE.MeshMatcapMaterial,
  'MeshPhongMaterial': THREE.MeshPhongMaterial,
  'MeshToonMaterial': THREE.MeshToonMaterial,
  'MeshStandardMaterial': THREE.MeshStandardMaterial,
  'MeshPhysicalMaterial': THREE.MeshPhysicalMaterial,
  'RawShaderMaterial': THREE.RawShaderMaterial,
  'ShaderMaterial': THREE.ShaderMaterial,
  'ShadowMaterial': THREE.ShadowMaterial,
  'SpriteMaterial': THREE.SpriteMaterial,
  'PointsMaterial': THREE.PointsMaterial
};
const vertexShaderVariables = [
  'uniform mat4 projectionMatrix;',
  'uniform mat4 modelViewMatrix;\n',
  'attribute vec3 position;\n\n',
].join('\n');
const meshMaterialOptions = [
  {label: "MeshBasicMaterial", value: "MeshBasicMaterial"},
  {label: "MeshDepthMaterial", value: "MeshDepthMaterial"},
  {label: "MeshNormalMaterial", value: "MeshNormalMaterial"},
  {label: "MeshLambertMaterial", value: "MeshLambertMaterial"},
  {label: "MeshMatcapMaterial", value: "MeshMatcapMaterial"},
  {label: "MeshPhongMaterial", value: "MeshPhongMaterial"},
  {label: "MeshToonMaterial", value: "MeshToonMaterial"},
  {label: "MeshStandardMaterial", value: "MeshStandardMaterial"},
  {label: "MeshPhysicalMaterial", value: "MeshPhysicalMaterial"},
  {label: "RawShaderMaterial", value: "RawShaderMaterial"},
  {label: "ShaderMaterial", value: "ShaderMaterial"},
  {label: "ShadowMaterial", value: "ShadowMaterial"}
];
const lineMaterialOptions = [
  {label: "LineBasicMaterial", value: "LineBasicMaterial"},
  {label: "LineDashedMaterial", value: "LineDashedMaterial"},
  {label: "RawShaderMaterial", value: "RawShaderMaterial"},
  {label: "ShaderMaterial", value: "ShaderMaterial"}
];
const spriteMaterialOptions = [
  {label: "SpriteMaterial", value: "SpriteMaterial"},
  {label: "RawShaderMaterial", value: "RawShaderMaterial"},
  {label: "ShaderMaterial", value: "ShaderMaterial"}
];
const pointsMaterialOptions = [
  {label: "PointsMaterial", value: "PointsMaterial"},
  {label: "RawShaderMaterial", value: "RawShaderMaterial"},
  {label: "ShaderMaterial", value: "ShaderMaterial"}
];

let currentObject;
let currentMaterialSlot = 0;

onMounted(() => {
  Hooks.useAddSignal("objectSelected", objectSelected);
  Hooks.useAddSignal("materialChanged", refreshUI);
})
onBeforeUnmount(() => {
  Hooks.useRemoveSignal("objectSelected", objectSelected);
  Hooks.useRemoveSignal("materialChanged", refreshUI);
})

function objectSelected(object) {
  let hasMaterialCopy = false;
  if (object && object.material) {
    hasMaterialCopy = true;
    if (Array.isArray(object.material) && object.material.length === 0) {
      hasMaterialCopy = false;
    }
  }
  if (hasMaterialCopy) {
    currentObject = object;
    refreshUI();
    hasMaterial.value = true;
  } else {
    currentObject = null;
    hasMaterial.value = false;
  }
}

function updateSlot() {
  currentMaterialSlot = objectData.slot;
  refreshUI();
}

const update = () => {
  let material = App.getObjectMaterial(currentObject, currentMaterialSlot);

  if (material) {
    if (material.type !== objectData.type) {
      material = new materialClasses[objectData.type]();

      if (material.type === 'RawShaderMaterial') {
        material.vertexShader = vertexShaderVariables + material.vertexShader;
      }

      if (Array.isArray(currentObject.material)) {
        // 不要移除多个材质。仅移除所选的材质
        App.removeMaterial(currentObject.material[currentMaterialSlot]);
      } else {
        App.removeMaterial(currentObject.material);
      }

      App.execute(new SetMaterialCommand(currentObject, material, currentMaterialSlot), 'New Material: ' + objectData.type);
      App.addMaterial(material);
      // TODO 复制场景图中的其他引用
      //保留当前名称和UUID
      //也应该有办法创造一个独特的
      //为当前对象显式复制
      //将当前材料附加到其他对象。
    }

    try {
      const userData = JSON.parse(objectData.userData);
      if (JSON.stringify(material.userData) != JSON.stringify(userData)) {
        App.execute(new SetMaterialValueCommand(currentObject, 'userData', userData, currentMaterialSlot));
      }
    } catch (exception) {
      console.warn(exception);
    }
    refreshUI();
  }
}

const refreshUI = Utils.throttle(function() {
  if (!currentObject) return;
  let material = currentObject.material;
  if (Array.isArray(material)) {
    const options: Array<{ label: string, value: number }> = [];
    currentMaterialSlot = Math.max(0, Math.min(material.length, currentMaterialSlot));

    for (let i = 0; i < material.length; i++) {
      options.push({
        label: String(i + 1) + ': ' + material[i].name,
        value: i
      })
    }

    slotOptions.value = options;
    objectData.slot = currentMaterialSlot;
  }

  material = App.getObjectMaterial(currentObject, currentMaterialSlot);

  Hooks.useDispatchSignal('materialCurrentSlotChange', currentMaterialSlot);

  if (material.uuid !== undefined) {
    objectData.uuid = material.uuid;
  }
  if (material.name !== undefined) {
    objectData.name = material.name;
  }
  if (currentObject.isMesh) {
    typeOptions.value = meshMaterialOptions;
  } else if (currentObject.isSprite) {
    typeOptions.value = spriteMaterialOptions;
  } else if (currentObject.isPoints) {
    typeOptions.value = pointsMaterialOptions;
  } else if (currentObject.isLine) {
    typeOptions.value = lineMaterialOptions;
  }
  objectData.type = material.type;

  setRowVisibility();

  try {
    objectData.userData = JSON.stringify(material.userData, null, '  ');
  } catch (error) {
    console.log(error);
  }
},100)

const materialSlotIsShow = ref(false);

function setRowVisibility() {
  const material = currentObject.material;

  if (Array.isArray(material)) {
    materialSlotIsShow.value = true;
  } else {
    materialSlotIsShow.value = false;
  }
}

//更新name
function updateName() {
  App.execute(new SetMaterialValueCommand(App.selected, 'name', objectData.name, currentMaterialSlot));
}

const userDataStatus = ref<any>(undefined)
const userDataEditorShow = ref(false);
const handleUserDataClick = () => {
  userDataEditorShow.value = true;
}
</script>

<template>
  <div v-show="hasMaterial">
    <SceneAllMaterials />

    <!-- Current material slot -->
    <div class="sider-scene-material-item" v-if="materialSlotIsShow">
      <span>{{ t("layout.sider.material.slot") }}</span>
      <div>
        <n-select size="small" v-model:value="objectData.slot" :options="slotOptions" @update:value="updateSlot" />
      </div>
    </div>
    <!-- type -->
    <div class="sider-scene-material-item">
      <span>{{ t("layout.sider.object.type") }}</span>
      <div>
        <n-select size="small" v-model:value="objectData.type" :options="typeOptions" @update:value="update" />
      </div>
    </div>
    <!-- uuid -->
    <div class="sider-scene-material-item">
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
    <div class="sider-scene-material-item">
      <span>{{ t("layout.sider.object.name") }}</span>
      <div>
        <n-input v-model:value="objectData.name" type="text" size="small" @update:value="updateName" />
      </div>
    </div>

    <!-- program -->
    <SidebarMaterialProgram property="vertexShader" />

    <!-- color -->
    <SidebarMaterialColorProperty property="color" name="Color" />

    <!-- specular -->
    <SidebarMaterialColorProperty property="specular" name="Specular" />

    <!-- shininess -->
    <SidebarMaterialNumberProperty property="shininess" name="Shininess" />

    <!-- emissive -->
    <SidebarMaterialColorProperty property="emissive" name="Emissive" />

    <!-- reflectivity -->
    <SidebarMaterialNumberProperty property="reflectivity" name="Reflectivity" :decimal="2" />

    <!-- roughness -->
    <SidebarMaterialNumberProperty property="roughness" name="Roughness" :decimal="2" :range="[0, 1]" />

    <!-- metalness -->
    <SidebarMaterialNumberProperty property="metalness" name="Metalness" :decimal="2" :range="[0, 1]" />

    <!-- clearcoat -->
    <SidebarMaterialNumberProperty property="clearcoat" name="Clearcoat" :decimal="2" :range="[0, 1]" />

    <!-- clearcoatRoughness -->
    <SidebarMaterialNumberProperty property="clearcoatRoughness" name="Clearcoat Roughness" :decimal="2"
      :range="[0, 1]" />

    <!-- iridescence -->
    <SidebarMaterialNumberProperty property="iridescence" name="Iridescence" :decimal="2" :range="[0, 1]" />

    <!-- iridescenceIOR -->
    <SidebarMaterialNumberProperty property="iridescenceIOR" name="Thin-Film IOR" :decimal="2" :range="[1, 5]" />

    <!-- 薄膜最大厚度 -->
    <SidebarMaterialNumberProperty property="iridescenceThicknessMaximum" name="Thin-Film Thickness"
      :range="[0, Infinity]" unit="nm" :step="10" :keyframe="false" />

    <!-- sheen -->
    <SidebarMaterialNumberProperty property="sheen" name="Sheen" :decimal="2" :range="[0, 1]" />

    <!-- sheenRoughness -->
    <SidebarMaterialNumberProperty property="sheenRoughness" name="Sheen Roughness" :decimal="2" :range="[0, 1]" />

    <!-- specular -->
    <SidebarMaterialColorProperty property="sheenColor" name="Sheen Color" />

    <!-- transmission 透光 -->
    <SidebarMaterialNumberProperty property="transmission" name="Transmission" :decimal="2" :range="[0, 1]" />

    <!-- attenuation distance 衰减距离 -->
    <SidebarMaterialNumberProperty property="attenuationDistance" name="Attenuation Distance" />

    <!-- attenuation tint 衰减色 -->
    <SidebarMaterialColorProperty property="attenuationColor" name="Attenuation Color" />

    <!-- thickness 厚度 -->
    <SidebarMaterialNumberProperty property="thickness" name="Thickness" />

    <!-- vertex colors 顶点颜色 -->
    <SidebarMaterialBooleanProperty property="vertexColors" name="Vertex Colors" />

    <!-- depth packing 深度包装 -->
    <SidebarMaterialConstantProperty property="depthPacking" name="Depth Packing"
      :options="[{ label: 'Basic', value: [THREE.BasicDepthPacking] }, { label: 'RGBA', value: [THREE.RGBADepthPacking] }]" />

    <!-- map 贴图 -->
    <SidebarMaterialMapProperty property="map" name="Map" />

    <!-- specular map 高光贴图 -->
    <SidebarMaterialMapProperty property="specularMap" name="Specular Map" />

    <!-- emissive map 自发光贴图 -->
    <SidebarMaterialMapProperty property="emissiveMap" name="Emissive Map" />

    <!-- matcap map 材质捕获 -->
    <SidebarMaterialMapProperty property="matcap" name="Matcap" />

    <!-- alpha map 透明贴图 -->
    <SidebarMaterialMapProperty property="alphaMap" name="Alpha Map" />

    <!-- bump map 凹凸贴图 -->
    <SidebarMaterialMapProperty property="bumpMap" name="Bump Map" />

    <!-- normal map 法线贴图 -->
    <SidebarMaterialMapProperty property="normalMap" name="Normal Map" />

    <!-- clearcoat normal map 清漆法线贴图 -->
    <SidebarMaterialMapProperty property="clearcoatNormalMap" name="Clearcoat Normal Map" />

    <!-- displacement map 置换贴图 -->
    <SidebarMaterialMapProperty property="displacementMap" name="Displace Map" />

    <!-- roughness map 粗糙贴图 -->
    <SidebarMaterialMapProperty property="roughnessMap" name="Rough Map" />

    <!-- metalness map 金属贴图 -->
    <SidebarMaterialMapProperty property="metalnessMap" name="Metal Map" />

    <!-- iridescence map 彩虹色贴图 -->
    <SidebarMaterialMapProperty property="iridescenceMap" name="Irid Map" />

    <!-- sheen color map -->
    <SidebarMaterialMapProperty property="sheenColorMap" name="Sheen Color Map" />

    <!-- sheen roughness map -->
    <SidebarMaterialMapProperty property="sheenRoughnessMap" name="Sheen Rough. Map" />

    <!-- iridescence thickness map 彩虹色厚度贴图 -->
    <SidebarMaterialMapProperty property="iridescenceThicknessMap" name="Thin-Film Thickness Map" />

    <!-- env map 环境贴图 -->
    <SidebarMaterialMapProperty property="envMap" name="Env Map" />

    <!-- light map 环境贴图 -->
    <SidebarMaterialMapProperty property="lightMap" name="Light Map" />

    <!-- ambient occlusion map 环境光遮蔽贴图 -->
    <SidebarMaterialMapProperty property="aoMap" name="AO Map" />

    <!-- gradient map 渐变贴图 -->
    <SidebarMaterialMapProperty property="gradientMap" name="Gradient Map" />

    <!-- transmission map 透光贴图 -->
    <SidebarMaterialMapProperty property="transmissionMap" name="Transmission Map" />

    <!-- thickness map 厚度贴图 -->
    <SidebarMaterialMapProperty property="thicknessMap" name="Thickness Map" />

    <!-- side 面 -->
    <SidebarMaterialConstantProperty property="side" name="Side" :options="[
            { label: 'Front', value:0 },
            { label: 'Back', value: 1 },
            { label: 'Double', value: 2 }
        ]" />

    <!-- size 大小 -->
    <SidebarMaterialNumberProperty property="size" name="Size" :range="[0, Infinity]" />

    <!-- sizeAttenuation 大小衰减 -->
    <SidebarMaterialBooleanProperty property="sizeAttenuation" name="Size Attenuation" />

    <!-- flatShading 平面着色 -->
    <SidebarMaterialBooleanProperty property="flatShading" name="Flat Shading" />

    <!-- blending 混合 -->
    <SidebarMaterialConstantProperty property="blending" name="Blending" :options="[
            { label: 'No', value:0 },
            { label: 'Normal', value: 1 },
            { label: 'Additive', value: 2 },
            { label: 'Subtractive', value: 3 },
            { label: 'Multiply', value: 4 },
            { label: 'Custom', value: 5 }
        ]" />

    <!-- opacity 透明度 -->
    <SidebarMaterialNumberProperty property="opacity" name="Opacity" :decimal="2" :range="[0, 1]" />

    <!-- transparent 透明性 -->
    <SidebarMaterialBooleanProperty property="transparent" name="Transparent" />

    <!-- alpha test α测试 -->
    <SidebarMaterialNumberProperty property="alphaTest" name="Alpha Test" :decimal="2" :range="[0, 1]" />

    <!-- depth test 深度测试 -->
    <SidebarMaterialBooleanProperty property="depthTest" name="Depth Test" />

    <!-- depth write 深度缓冲 -->
    <SidebarMaterialBooleanProperty property="depthWrite" name="Depth Write" />

    <!-- wireframe 线框 -->
    <SidebarMaterialBooleanProperty property="wireframe" name="Wireframe" />

    <!-- userdata 自定义数据 -->
    <div class="sider-scene-material-item">
      <span>{{ t("layout.sider.object.userdata") }}</span>
      <div>
        <n-input type="textarea" v-model:value="objectData.userData" round :rows="5" readonly :status="userDataStatus"
          @click.stop="handleUserDataClick" />
      </div>
    </div>

    <UserData v-model:show="userDataEditorShow" @update:show="(s) => userDataEditorShow = s"
      v-model:value="objectData.userData" @update:value="update" />
  </div>

  <n-result v-show="!hasMaterial" status="418" title="Empty"
    :description="t('prompt[\'No material data for the time being\']')" />
</template>

<style lang="less" scoped>
.sider-scene-material-item {
  display: flex;
  justify-content: space-between;
  margin: 15px 0;
  align-items: center;

  & > span {
    min-width: 80px;
  }

  & > div {
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
</style>
