<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'

const proposal = ref(null)
const errorText = ref('')

onMounted(async () => {
  try {
    const res = await axios.get('/api/proposal')
    proposal.value = res.data
  } catch (error) {
    console.log(error)
    errorText.value = 'Could not load proposal content.'
  }
})
</script>

<template>
  <div class="container py-4">
    <p v-if="errorText" class="alert alert-danger">{{ errorText }}</p>

    <div v-if="proposal">
      <p class="text-muted small">{{ proposal.snapshotNote }}</p>
      <h1 class="mb-3">{{ proposal.title }}</h1>
      <p><strong>Section</strong> {{ proposal.section }}</p>
      <p><strong>Team Name</strong> {{ proposal.teamName }}</p>

      <h2 class="h4 mt-4">Members of the Team</h2>
      <table class="table table-bordered">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email ID</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in proposal.members">
            <td>{{ m.n }}</td>
            <td>{{ m.name }}</td>
            <td>{{ m.email }}</td>
          </tr>
        </tbody>
      </table>

      <h2 class="h4 mt-4">Project Overview</h2>
      <p v-for="p in proposal.overview">{{ p }}</p>

      <h2 class="h4 mt-4">Objective(s) of the Project</h2>
      <ol>
        <li v-for="item in proposal.objectives">{{ item }}</li>
      </ol>

      <h2 class="h4 mt-4">Project Functionality</h2>
      <div v-for="f in proposal.functionality" class="mb-3">
        <h3 class="h5">{{ f.name }}</h3>
        <p>{{ f.text }}</p>
      </div>

      <h2 class="h4 mt-4">The kind of technology you are using</h2>
      <div v-for="t in proposal.technology" class="mb-2">
        <p class="mb-0"><strong>{{ t.name }}</strong></p>
        <p>{{ t.text }}</p>
      </div>

      <h2 class="h4 mt-4">The kind of data store(s) you are using</h2>
      <p>{{ proposal.dataStores }}</p>

      <h2 class="h4 mt-4">List of APIs used</h2>
      <div v-for="a in proposal.apis" class="mb-3">
        <p class="mb-0"><strong>{{ a.name }}</strong></p>
        <p class="mb-0">{{ a.text }}</p>
        <p><a :href="a.url" target="_blank" rel="noopener noreferrer">{{ a.url }}</a></p>
      </div>

      <h2 class="h4 mt-4">Who do what?</h2>
      <table class="table table-bordered">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Task</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in proposal.whoDoWhat">
            <td>{{ w.n }}</td>
            <td>{{ w.name }}</td>
            <td>{{ w.task }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
