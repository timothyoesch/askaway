<script setup>
import PocketBase from 'pocketbase';
import {ref, onMounted, onUnmounted} from 'vue';
import {HandThumbUpIcon as SolidIcon} from '@heroicons/vue/24/solid';
import { Toaster, toast } from 'vue-sonner'

const route = useRoute();
const config = useRuntimeConfig();
const pb = new PocketBase(config.public.pb_base);
const {uuid} = route.params;
const {moderation_uuid} = route.query;


const data = reactive({
    event: null,
    questions: [],
    sort : 'likes'
});

const subscriptions = ref({
    event: null,
    questions: null
});

const getEvent = async (uuid) => {
    try {
        const res = await pb.collection('events').getFirstListItem(`uuid="${uuid}"`);
        if (res.moderation_uuid !== moderation_uuid) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Forbidden',
                message: 'You are not allowed to view this event'
            });
        }
        return res;
    } catch (err) {
        console.error(err);
        navigateTo('/404');
    }
};

const subScribeToEvent = async (uuid) => {
    pb.collection('events').subscribe(uuid, (e) => {
        if (e.action === 'update') {
            data.event = e.record;
        } else if (e.action === 'delete') {
            navigateTo('/404');
        }
    })
};

const getQuestions = async (event) => {
    var filter = `event_id="${event.id}"`;
    try {
        const res = await pb.collection('questions').getList(1, 5000, {
            filter: filter,
            sort: 'created',
        });
        return res.items;
    } catch (err) {
        console.error(err);
    }
};

const subscribeToQuestions = async (event) => {
    pb.collection('questions').subscribe("*", (e) => {
        if (e.record.event_id !== event) {
            return;
        }
        if (e.action === 'create') {
            data.questions.push(e.record);

        } else if (e.action === 'update') {
            const index = data.questions.findIndex((q) => q.id === e.record.id);
            if (e.record.answered_at !== null && e.record.answered_at !== '') {
                data.questions.splice(index, 1);
                return;
            } else if (index === -1) {
                data.questions.push(e.record);
            } else {
                data.questions[index] = e.record;
            }
        } else if (e.action === 'delete') {
            const index = data.questions.findIndex((q) => q.id === e.record.id);
            if (index !== -1) {
                data.questions.splice(index, 1);
            }
        }
        sortQuestions(data.sort);
    })
};

onMounted(async () => {
    const { uuid } = route.params;
    data.event = await getEvent(uuid);
    subscriptions.event = await subScribeToEvent(data.event.id);
    data.questions = await getQuestions(data.event);
    subscriptions.questions = await subscribeToQuestions(data.event.id);

    useSeoMeta({
        title: `Ask Away! - Fragen moderieren für ${data.event.name}`,
        meta: [
            {
                name: 'description',
                content: `Moderation für ${data.event.name}`,
            },
        ],
    });
});

onUnmounted(() => {
    if (subscriptions.value.event) {
        pb.collection('events').unsubscribe(subscriptions.value.event);
    }
    if (subscriptions.value.questions) {
        pb.collection('questions').unsubscribe(subscriptions.value.questions);
    }
});

const changeStatus = async (questionId, status) => {
    try {
        const question = await pb.collection('questions').getOne(questionId);
        if (status === 'approved') {
            question.approved_at = new Date().toISOString();
            await pb.collection('questions').update(questionId, question);
        } else if (status === 'rejected') {
            pb.collection('questions').delete(questionId);
        } else if (status === 'answered') {
            question.answered_at = new Date().toISOString();
            await pb.collection('questions').update(questionId, question);
        }
        sortQuestions(data.sort);
    } catch (err) {
        console.error(err);
    }
};

const sortQuestions = (sort) => {
    data.sort = sort;
    if (sort === 'likes') {
        console.log(sort);
        data.questions.sort((a, b) => b.likes.length - a.likes.length);
    } else if (sort === 'newest') {
        data.questions.sort((a, b) => new Date(b.created) - new Date(a.created));
    } else if (sort === 'moderation') {
        console.log(sort);
        data.questions.sort((a, b) => {
            if (a.approved_at === null && b.approved_at === null) {
                return 0;
            } else if (a.approved_at === null || a.approved_at === '') {
                return -1;
            } else if (b.approved_at === null || b.approved_at === '') {
                return 1;
            } else {
                return new Date(b.approved_at) - new Date(a.approved_at);
            }
        });
    }
    let activeButton = document.querySelector('.ask-event-questions__header__sort .underline');
    let newButton = document.querySelector(`.ask-event-questions__header__sort span#sort-${sort}`);
    if (activeButton) {
        activeButton.classList.remove('underline');
    }
    if (newButton) {
        newButton.classList.add('underline');
    }
};

const copyLink = (uuid) => {
    const link = `${window.location.origin}/e/${uuid}`;
    navigator.clipboard.writeText(link).then(() => {
        toast.success('Link kopiert', {
            duration: 2000,
            position: 'top-right',
        });
    }).catch((err) => {
        console.error('Error copying link: ', err);
    });
};

</script>

<template>
    <div v-if="data.event" class="mb-20">
        <div class="ask-event-questions ask-container mt-10">
            <a href="#"
                class="text-secondary text-sm md:text-lg cursor-pointer ask-button w-fit mb-4"
                @click="copyLink(data.event.uuid)"
            >
                Eventlink kopieren
            </a>
            <div class="ask-event-questions__header flex justify-between items-end mb-4 md:mb-8">
                <h2 class="text-2xl md:text-4xl font-bold font-allan text-secondary">
                    Fragen moderation
                </h2>
                <div class="ask-event-questions__header__sort">
                    <span class="text-secondary text-sm md:text-lg cursor-pointer underline" @click="sortQuestions('likes')" id="sort-likes">Meiste Likes</span>
                    |
                    <span class="text-secondary text-sm md:text-lg cursor-pointer" @click="sortQuestions('newest')" id="sort-newest"> Neueste</span>
                    |
                    <span class="text-secondary text-sm md:text-lg cursor-pointer" @click="sortQuestions('moderation')" id="sort-moderation"> Moderation</span>
                </div>
            </div>
            <div v-for="question in data.questions" :id="question.id" v-bind:key="question.id" class="p-4 md:p-6 bg-secondary/10 mb-4 rounded-md">
                <div class="flex justify-between items-start gap-4 md:gap-8">
                    <p>
                        {{ question.content }}
                    </p>
                    <div class="ask-event-questions__likes flex flex-col items-center">
                        <SolidIcon class="h-6 w-6 text-secondary" />
                        <p class="text-lg font-bold text-secondary">
                            {{ question.likes.length }}
                        </p>
                    </div>
                </div>
                <div class="flex gap-8 items-center mt-4">
                    <a
                        href="#"
                        class="text-sm text-primary font-bold underline text-green-800"
                        @click.prevent="changeStatus(question.id, 'approved')"
                        v-if="question.approved_at === null || question.approved_at === ''"
                    >
                        Freischalten
                    </a>
                    <a
                        href="#"
                        class="text-sm text-primary font-bold underline text-green-800"
                        @click.prevent="changeStatus(question.id, 'answered')"
                        v-else-if="question.approved_at !== null && (question.answered_at === null || question.answered_at === '')"
                    >
                        Beantwortet
                    </a>
                    <a
                        href="#"
                        class="text-sm text-primary font-bold underline text-red-800"
                        @click.prevent="changeStatus(question.id, 'rejected')"
                    >
                        Löschen
                    </a>
                </div>
            </div>
        </div>
        <Toaster />
    </div>
</template>