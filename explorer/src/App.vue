<template>
    <header class="header">
        <label class="title">postcss-styl</label>
        <SnsBar />
        <a href="https://github.com/ota-meshi/postcss-styl" class="github-link"
            >View on GitHub</a
        >
    </header>
    <main class="main">
        <AstExplorer />
    </main>
</template>

<script>
import AstExplorer from "./components/AstExplorer.vue"
import SnsBar from "./components/SnsBar.vue"

export default {
    name: "App",
    components: {
        AstExplorer,
        SnsBar,
    },
}
</script>
<style scoped lang="stylus">
.header {
  height: 32px;
  display: flex;
  border-bottom: 1px #ddd solid;
}

.title {
  font-size: 120%;
  flex-grow: 1;
  display: flex;
  align-items: center;
}

.github-link {
  display: flex;
  align-items: center;
}

.main {
  position: relative;
  height: calc(100vh - 32px - 16px);
}
</style>
