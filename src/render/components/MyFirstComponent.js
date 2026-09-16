// components/MyFirstComponent.js
window.MyFirstComponent = {
  props: ['initialCount'],
  setup(props) {
    const { ref } = Vue;
    const count = ref(props.initialCount || 0);

    function increment() {
      count.value++;
    }

    return {
      count,
      increment
    };
  },
  template: `
    <div class="my-first-component">
      <p>Счётчик: {{ count }}</p>
      <button @click="increment">+1</button>
    </div>
  `
};