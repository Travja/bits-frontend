<script lang="ts">
	import '../../app.css';
	import { backendUrl }    from '$lib/lib';
	import { goto }          from '$app/navigation';
	import { setCredential } from '$lib/credential';

	let username = '';
	let password = '';

	let error = '';

	const login = () => {
		fetch(backendUrl + '/credentials/login', {
			method:  'POST',
			headers: {
				'Authorization': 'Basic ' + btoa(username + ':' + password)
			}
		}).then(res => {
			if (res.ok) {
				console.log('Login successful');
				// Store it in the credential store
				setCredential(username, password);
				goto('/');
			} else {
				console.error('Login failed');
				error = 'Login failed';
			}
		}).catch(err => {
			console.error(err);
			error = 'Login failed';
		});
	};

</script>

<h1>Login</h1>
<form on:submit|preventDefault={login}>
	<input bind:value={username} id="username" placeholder="Username" type="text" />
	<input bind:value={password} id="password" placeholder="Password" type="password" />
	{#if error}
		<p class="error">{error}</p>
	{/if}
	<button>Login</button>
</form>

<style>
    h1 {
        text-align: center;
    }

    input {
        display: block;
        margin: 0 auto;
        margin-bottom: 1em;
    }

    .error {
        color: red;
        text-align: center;
    }

    button {
        display: block;
        margin: 0 auto;
    }
</style>