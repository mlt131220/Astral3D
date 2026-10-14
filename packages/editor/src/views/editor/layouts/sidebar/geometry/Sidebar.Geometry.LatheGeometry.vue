<script setup lang="ts">
import {reactive, onMounted} from "vue";
import {LatheGeometry} from "three";
import {SetGeometryCommand,App} from '@astral3d/engine';
import {t} from "@/language";
import EsInputNumber from "@/components/es/EsInputNumber.vue";

let objectData = reactive({
  segments: 12,
  phiStart:0,
  phiLength:1,
  points:[]
})

onMounted(() => {
  const geometry = App.selected?.geometry;
  const parameters = geometry.parameters;
  Object.keys(parameters).forEach(key => {
    objectData[key] = parameters[key]
  })
  objectData.phiStart *= 180 / Math.PI;
  objectData.phiLength *= 180 / Math.PI;
})

function update() {
  if(!App.selected) return;

  App.execute(new SetGeometryCommand(App.selected, new LatheGeometry(
      objectData.points,
      objectData.segments,
      objectData.phiStart * Math.PI / 180,
      objectData.phiLength * Math.PI / 180
  )))
}
</script>

<template>
  <div>
    <n-divider/>

    <!--  segments  -->
    <div class="sider-scene-geometry-item">
      <span>{{ t("layout.sider.scene.Segments") }}</span>

      <EsInputNumber v-model:value="objectData.segments" class="!w-90px" size="small" :decimal="0"
                     :show-button="false" @change="update()"/>
    </div>

    <!--  phiStart  -->
    <div class="sider-scene-geometry-item">
      <span>{{ t("layout.sider.scene['Phi start']") }}</span>

      <EsInputNumber v-model:value="objectData.phiStart" class="!w-90px" size="small" :decimal="2"
                     :show-button="false" @change="update()"/>
    </div>

    <!--  phiLength  -->
    <div class="sider-scene-geometry-item">
      <span>{{ t("layout.sider.scene['Phi length']") }}</span>

      <EsInputNumber v-model:value="objectData.phiLength" class="!w-90px" size="small" :decimal="2"
                     :show-button="false" @change="update()"/>
    </div>

    <!--  points  -->
    <div class="sider-scene-geometry-item">
      <span>{{ t("layout.sider.scene.Points") }}</span>

      <!--  TODO UIPoints2 objectData.points   -->
    </div>
  </div>
</template>