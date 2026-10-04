<script setup>
import {ref} from 'vue';
import {createPinia,defineStore,setActivePinia} from 'pinia';
import {ElButton,ElInput,ElTag} from 'element-plus';
import 'element-plus/dist/index.css';
import {useForm,useField} from 'vee-validate';
import {createI18n} from 'vue-i18n';
import words from '../locales/zh-CN/饭票.json';
const cabinet=createPinia();setActivePinia(cabinet);
const useRice=defineStore('school_student_vue',{state:()=>({delivery_count:0,product_name:'午饭'}),actions:{stamp(name){this.delivery_count++;this.product_name=name;}}});
const rice=useRice(cabinet);
const dictionary=createI18n({legacy:false,locale:'zh-CN',messages:{'zh-CN':words}});
const {handleSubmit}=useForm();const {value,errorMessage}=useField('rice',v=>typeof v==='string'&&v.trim().length>0&&v.length<=40||'写 1—40 个字');value.value='午饭';
const submit=handleSubmit(v=>rice.stamp(v.rice));
const glare=ref(false);
</script>
<template><section class="vue-rice" data-framework="vue"><div class="vue-caption">{{dictionary.global.t('title')}} <small>14:02 停水</small></div><form @submit="submit"><label for="vue-rice-name">票名</label><ElInput id="vue-rice-name" v-model="value" maxlength="40"/><p role="status">{{errorMessage}}</p><ElButton type="warning" native-type="submit">{{dictionary.global.t('submit')}}</ElButton><ElTag data-testid="pinia-count">{{rice.delivery_count}} 张 · {{rice.product_name}}</ElTag></form><p data-jquery-display="vue" :class="{greasy:glare}">本窗不卖饭</p><button @click="glare=!glare">擦窗</button></section></template>
<style lang="scss">$stain:#eee7b4;.vue-rice{background:$stain;border:5px ridge #939382;padding:18px;width:min(390px,100%);color:#454236;transform:rotate(.7deg);box-shadow:6px 9px 0 #bebbb0;.vue-caption{font:bold 25px SimSun,serif;border-bottom:2px solid #484b3c;small{font:11px monospace;color:#920b13}}form{margin:17px 0}.greasy{filter:blur(.4px);text-decoration:underline wavy #958300}}</style>
