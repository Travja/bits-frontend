<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
    interface Props {
        children?: import('svelte').Snippet;
    }

    let { children }: Props = $props();
</script>

<svelte:head>
	<title>Bits</title>
</svelte:head>

<header>
	<nav>
		<a class:active={$page.url.pathname === '/'}
			 href="/"
		>Home</a>
		<a class:active={$page.url.pathname === '/gas'}
			 href="/gas"
		>Gas</a>
	</nav>
</header>
<div id="body">
	{@render children?.()}
</div>

<style>
    header {
        background-color: #333;
        color: white;
        padding: 0 0.5em;
    }

    nav {
        display: flex;
        justify-content: center;
        gap: 1em;
    }

    a {
        padding: 0.75rem;
        color: white;
        text-decoration: none;
    }

    a.active {
        background-color: rgba(255, 255, 255, 0.1);
    }

    a:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }

    #body {
        padding: 0.5rem;
    }
</style>