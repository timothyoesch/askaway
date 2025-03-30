<script setup>
const config = useRuntimeConfig();
import { RocketLaunchIcon } from "@heroicons/vue/24/outline";
import { reactive, onMounted } from "vue";
import PocketBase from 'pocketbase';
import { v4 as uuidv4 } from 'uuid';

const pb = new PocketBase(config.public.pb_base);

const event = reactive({
  title: null,
});

const submit = async () => {
  if (!event.title) {
    alert("Bitte gib einen Titel ein.");
    return;
  }

  pb.collection('events').create({
    name: event.title,
    uuid : uuidv4(),
    moderation_uuid: uuidv4(),
    moderated: true
  })
    .then((res) => {
        navigateTo(`/mod/${res.uuid}?moderation_uuid=${res.moderation_uuid}`);
    })
};
useSeoMeta({
    title: "AskAway!",
    ogTitle: "AskAway!",
    description: "Ask Away! - Kostenloses, simples und tracking-freies Tool für Live Q&A-Sessions",
    ogDescription: "Ask Away! - Kostenloses, simples und tracking-freies Tool für Live Q&A-Sessions",
    ogImage: '/og.png',
    twitterCard: 'summary_large_image',
});
</script>

<template>
  <div
    class="h-screen bg-accent text-secondary p-4 md:p-12 flex flex-col items-center justify-center"
  >
    <div class="max-w-[1080px] w-full text-center">
      <h1 class="font-allan text-4xl md:text-9xl font-bold">Ask Away!</h1>
      <p class="text-2xl mt-4">
        Kostenloses, simples und tracking-freies Tool für Live Q&A-Sessions.
      </p>
      <form
        action="/init"
        class="text-xl mt-8"
        ref="initForm"
        @submit.prevent="submit"
      >
        <div class="flex gap-4">
          <input
            type="text"
            name="title"
            placeholder="Wie lautet der Titel deiner Veranstaltung?"
            v-model="event.title"
            class="w-[-webkit-fill-available] border-b-2 border-secondary bg-transparent focus:outline-none transition-colors duration-100"
          />
          <button type="submit" class="ask-button" href="#">
            Session starten
            <RocketLaunchIcon />
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
