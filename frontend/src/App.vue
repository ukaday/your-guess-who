<script setup lang="ts">
import { ref, onMounted } from 'vue';

const healthStatus = ref<string | null>(null);

onMounted(async () => {
    const response = await fetch('/api/health');
    const data = (await response.json()) as { status: string };
    healthStatus.value = data.status;
});
</script>

<template>
    <p>Health: {{ healthStatus }}</p>
</template>
