
<template>
  <div
    class="h-screen bg-accent text-secondary p-4 md:p-12 flex flex-col items-center justify-center"
  >
    <div class="max-w-[1080px] w-full text-center">
      <h1 class="font-allan text-4xl md:text-9xl font-bold">Oh no!</h1>
      <p class="text-2xl mt-4">
        Leider konnten wir die Seite, die du suchst, nicht finden.
      </p>
      <div class="mt-4 flex justify-center items-center gap-4">
        <NuxtLink href="/" class="ask-button text-xl w-fit">Zurück zur Startseite</NuxtLink>
      </div>
    </div>
  </div>
</template>
