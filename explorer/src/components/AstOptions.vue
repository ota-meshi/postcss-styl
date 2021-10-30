<template>
    <div class="ast-options">
        <label
            ><input
                type="checkbox"
                :checked="modelValue.showLocations"
                @change="updateShowLocations($event.target.checked)"
            />
            Locations
        </label>
    </div>
</template>

<script>
export default {
    name: "AstOptions",
    props: {
        modelValue: {
            type: Object,
            default() {
                return {}
            },
        },
    },
    emits: ["update:modelValue"],
    methods: {
        updateShowLocations(newValue) {
            this.$emit("update:modelValue", {
                ...this.modelValue,
                showLocations: newValue,
            })
        },
    },
}
</script>

<style scoped lang="stylus">
.ast-options {
  text-align: right;
}

label {
  padding-left: 8px;
}
</style>
