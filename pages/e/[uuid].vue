<script setup>
const config = useRuntimeConfig();
import PocketBase from 'pocketbase';
import { onMounted, reactive, ref, onUnmounted } from 'vue';
import {HandThumbUpIcon as Icon, UserGroupIcon} from '@heroicons/vue/24/outline';
import {HandThumbUpIcon as SolidIcon, StarIcon} from '@heroicons/vue/24/solid';
import { Toaster, toast } from 'vue-sonner'
import { v4 as uuidv4 } from 'uuid';
const route = useRoute();
const pb = new PocketBase(config.public.pb_base);

const { hideform } = route.query;

const data = reactive({
    event: null,
    questions: [],
    participants: [],
    sort : 'likes'
});

const subscriptions = ref({
    event: null,
    questions: null,
    participants: null,
});

const newQuestion = reactive({
    content: null,
});

var likes = ref([]);

const getEvent = async (uuid) => {
    try {
        const res = await pb.collection('events').getFirstListItem(`uuid="${uuid}"`);
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
    if (event.moderated) {
        filter += `&& approved_at!=null`;
    }
    filter += `&& answered_at=null`;
    try {
        const res = await pb.collection('questions').getList(1, 5000, {
            filter: filter,
            sort: '-likes:length',
        });
        return res.items;
    } catch (err) {
        console.error(err);
        navigateTo('/404');
    }
};

const subscribeToQuestions = async (event) => {
    pb.collection('questions').subscribe("*", (e) => {
        if (e.record.event_id !== event) {
            return;
        }
        if (e.action === 'create') {
            if ((e.record.approved_at == null || e.record.approved_at === '') && data.event.moderated) {
                return;
            }
            data.questions.push(e.record);
        } else if (e.action === 'update') {
            const index = data.questions.findIndex((q) => q.id === e.record.id);
            if ((e.record.approved_at == null || e.record.approved_at === '') || (e.record.answered_at !== null && e.record.answered_at !== '')) {
                if (index !== -1) {
                    data.questions.splice(index, 1);
                }
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

const getParticipants = async (event) => {
    try {
        const res = await pb.collection('participants').getList(1, 5000, {
            filter: `event_id="${event.id}"`,
        });
        return res.items;
    } catch (err) {
        console.error(err);
        navigateTo('/404');
    }
};

const subscribeToParticipants = async (event) => {
    pb.collection('participants').subscribe("*", (e) => {
        if (e.record.event_id !== event) {
            return;
        }
        if (e.action === 'create') {
            data.participants.push(e.record);
        } else if (e.action === 'update') {
            const index = data.participants.findIndex((p) => p.id === e.record.id);
            if (index !== -1) {
                data.participants[index] = e.record;
            }
        } else if (e.action === 'delete') {
            const index = data.participants.findIndex((p) => p.id === e.record.id);
            if (index !== -1) {
                data.participants.splice(index, 1);
            }
        }
    })
};

const checkParticipantId = async (event) => {
    const participantId = localStorage.getItem(event.id + '_participant_id');
    if (!participantId) {
        const participant = await pb.collection('participants').create({
            event_id: event.id,
            uuid: uuidv4(),
        });
        localStorage.setItem(event.id + '_participant_id', participant.id);
    } else {
        // Check if participant exists in PocketBase
        try {
            const participant = await pb.collection('participants').getOne(participantId);
        } catch (err) {
            // If not, create a new participant
            const participant = await pb.collection('participants').create({
                event_id: event.id,
                uuid: uuidv4(),
            });
            localStorage.setItem(event.id + '_participant_id', participant.id);
        }
    }
    return participantId;
};

onMounted(async () => {
    const { uuid } = route.params;
    data.event = await getEvent(uuid);
    subscriptions.event = await subScribeToEvent(data.event.id);
    data.questions = await getQuestions(data.event);
    subscriptions.questions = await subscribeToQuestions(data.event.id);
    data.participants = await getParticipants(data.event);
    subscriptions.participants = await subscribeToParticipants(data.event.id);

    // Check if participant_id exists in local storage
    await checkParticipantId(data.event);

    likes.value = JSON.parse(localStorage.getItem(data.event.id + '_likes')) || [];

    // Autosize all textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((textarea) => {
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });
    });

    useSeoMeta({
        title: "AskAway! – " + data.event.name,
        ogTitle: "AskAway! – " + data.event.name,
        description: data.event.description || "Ask Away! ist ein kostenloses, simples und tracking-freies Tool für Live Q&A-Sessions.",
        ogDescription: data.event.description || "Ask Away! ist ein kostenloses, simples und tracking-freies Tool für Live Q&A-Sessions.",
        ogImage: '/og.png',
        twitterCard: 'summary_large_image',
    });
});

const sortQuestions = (sort) => {
    data.sort = sort;
    if (sort === 'likes') {
        data.questions.sort((a, b) => b.likes.length - a.likes.length);
    } else if (sort === 'newest') {
        data.questions.sort((a, b) => new Date(b.created) - new Date(a.created));
    } else if (sort === 'moderation') {
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
    data.questions.sort((a, b) => {
        if (a.pinned === b.pinned) {
            return 0;
        } else if (a.pinned === true) {
            console.log('a', a);
            console.log('b', b);
            return -1;
        } else {
            return 1;
        }
    });
};

const toggleLike = async (question) => {
    let participantId = await checkParticipantId(data.event);
    if (likes.value.includes(question.id)) {
        likes.value.splice(likes.value.indexOf(question.id), 1);
        try {
            const like = await pb.collection('likes').getFirstListItem(`question_id="${question.id}" && participant_id="${participantId}"`);
            await pb.collection('likes').delete(like.id);
        } catch (err) {
            // Like likely never existed
        }
    } else {
        likes.value.push(question.id);
        // Create new like in PocketBase
        const like = await pb.collection('likes').create({
            participant_id: participantId,
            question_id: question.id,
        });
        // Attach like to question in PocketBase
        pb.collection('questions').update(question.id, {
            likes: [...question.likes, like.id],
        });
    }
    localStorage.setItem(data.event.id + '_likes', JSON.stringify(likes.value));
    sortQuestions(data.sort);
};

const submitNewQuestion = async () => {
    let participantId = await checkParticipantId(data.event);
    if (!newQuestion.content) {
        alert('Bitte gib eine Frage ein.');
        return;
    }
    const question = await pb.collection('questions').create({
        content: newQuestion.content,
        event_id: data.event.id,
        participant_id: participantId,
    });
    toggleLike(question);
    if (!data.event.moderated) {
        data.questions.push(question);
    }
    newQuestion.content = null;
    // Reset textarea height
    const textarea = document.querySelector('textarea');
    if (textarea) {
        textarea.style.height = 'auto';
    }
    let toastOptions = {
        duration: 20000,
        position: 'top-right',
    }
    let toastMessage = '';
    if (data.event.moderated) {
        toastMessage = 'Frage erfolgreich eingereicht. Wir moderieren sie kurz und veröffentlichen sie gleich. Merci für deine Geduld.';
    } else {
        toastMessage = 'Frage erfolgreich eingereicht. Merci für deine Geduld.';
    }
    toast.success(toastMessage, toastOptions);
};

onUnmounted(() => {
    if (subscriptions.value.event) {
        pb.collection('events').unsubscribe(subscriptions.value.event);
    }
    if (subscriptions.value.questions) {
        pb.collection('questions').unsubscribe(subscriptions.value.questions);
    }

    if (subscriptions.value.participants) {
        pb.collection('participants').unsubscribe(subscriptions.value.participants);
    }
});
</script>

<template>
    <div v-if="data.event" class="mb-20 md:mb-40">
        <div class="ask-event-details bg-accent py-4 md:py-12 text-secondary">
            <div class="ask-container text-center">
                <div class="event-datetime" v-if="data.event.start_time">
                    <p>
                        {{
                        new Date(data.event.start_time)
                        .toLocaleDateString("de", {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        })
                        }}
                        |
                        {{
                        new Date(data.event.start_time)
                        .toLocaleTimeString("de", {
                        hour: '2-digit',
                        minute: '2-digit',
                        })
                        }}
                        Uhr
                    </p>
                </div>
                <h1 class="event-title mt-2 text-4xl md:text-6xl font-bold font-allan">
                    {{ data.event.name }}
                </h1>
                <p class="event-description mt-2 md:text-lg md:text-2xl" v-if="data.event.description"
                    v-html="data.event.description">
                </p>
                <div class="event-participants mt-4 flex justify-center items-center gap-2">
                    {{ data.participants.length }}
                    <UserGroupIcon class="h-6 w-6 text-secondary" />
                </div>
            </div>
        </div>
        <div class="ask-event-form ask-container" v-if="typeof hideform === 'undefined'">
            <div class="pt-10 ask-event-form__inner">
                <form action="/ask" class="md:text-xl" @submit.prevent="submitNewQuestion">
                    <div class="flex flex-col md:flex-row gap-4 items-end">
                        <textarea type="text" name="content" placeholder="Wie lautet deine Frage?"
                            v-model="newQuestion.content"
                            class="w-[-webkit-fill-available] border-b-2 border-secondary bg-transparent focus:outline-none transition-colors duration-100" />
                        <button type="submit" class="ask-button w-full md:w-fit text-lg md:text-xl" href="#">
                            Frage stellen
                        </button>
                    </div>
                </form>
            </div>
        </div>
        <div class="ask-event-questions ask-container mt-10">
            <div
                class="ask-event-questions__header flex flex-col md:flex-row justify-between items-start md:items-end mb-4 md:mb-8">
                <h2 class="text-2xl md:text-4xl font-bold font-allan text-secondary">
                    Offene Fragen
                </h2>
                <div class="ask-event-questions__header__sort">
                    <span class="text-secondary md:text-lg cursor-pointer underline" @click="sortQuestions('likes')"
                        id="sort-likes">Meiste Likes</span>
                    |
                    <span class="text-secondary md:text-lg cursor-pointer" @click="sortQuestions('newest')"
                        id="sort-newest"> Neueste</span>
                </div>
            </div>
            <div v-for="question in data.questions" :id="question.id" v-bind:key="question.id"
                class="p-4 md:p-6 bg-secondary/10 mb-4 flex justify-between items-start gap-4 md:gap-8 rounded-md relative border-2 border-accent"
                :class="{
                    '!border-secondary': question.pinned === true,
                }"
            >
                <p>
                    {{ question.content }}
                </p>
                <div class="ask-event-questions__likes flex flex-col items-center">
                    <SolidIcon v-if="likes.includes(question.id)" @click="toggleLike(question)"
                        class="cursor-pointer h-6 w-6 text-secondary" />
                    <Icon v-else @click="toggleLike(question)" class="cursor-pointer h-6 w-6 text-secondary" />
                    <p class="text-lg font-bold text-secondary">
                        {{ question.likes.length }}
                    </p>
                </div>
                <StarIcon
                    class="h-3 w-3 text-secondary absolute top-1 right-1"
                    v-if="question.pinned == true"
                />
            </div>
        </div>
        <Toaster />
    </div>
</template>