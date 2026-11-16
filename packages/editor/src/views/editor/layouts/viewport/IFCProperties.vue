<template>
  <n-card v-if="visible" class="absolute top-1 right-1 max-w-300px" content-style="padding: 5px 10px;">
    <n-collapse accordion default-expanded-names="bim">
      <template #arrow="{collapsed}">
        <n-icon v-if="collapsed">
          <PlanetOutline/>
        </n-icon>
        <n-icon v-else>
          <SunnyOutline/>
        </n-icon>
      </template>

      <n-collapse-item title="&nbsp;BIM 构件信息" name="bim">
        <div class="max-h-360px overflow-y-auto">
          <n-descriptions v-for="(item, index) in Object.keys(info)" :key="index"
                          label-placement="left" bordered size="small" :column="1">
            <template #header>
              <p class="py-2">{{ item }}</p>
            </template>

            <n-descriptions-item v-if="info[item] == null || typeof info[item] !== 'object'" :label="item">
              {{ info[item] ?? '-' }}
            </n-descriptions-item>

            <n-descriptions-item v-else v-for="(k,i) in Object.keys(info[item])" :key="i" :label="k">
              {{ info[item][k] }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </n-collapse-item>
    </n-collapse>
  </n-card>
</template>

<script setup lang="ts">
import {PlanetOutline, SunnyOutline} from "@vicons/ionicons5";
import {ref,onBeforeUnmount, onMounted} from "vue";
import {Hooks} from "@astral3d/engine";

const visible = ref(false);
const info = ref({})

function handleVisible(show:boolean,properties:any = {}){
  visible.value = show;
  info.value = properties;
}

onMounted(()=>{
  Hooks.useAddSignal("IFCPropertiesVisible",handleVisible);
})

onBeforeUnmount(()=>{
  Hooks.useRemoveSignal("IFCPropertiesVisible",handleVisible);
})
</script>
