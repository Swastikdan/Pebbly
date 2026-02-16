# Film Fanatic Redesign - Implementation Plan

## Phase 1: Play Button & Video Player Modal
1. Add Play button to media cards (HorizontalCard, VerticalCard)
2. Add Play button to movie detail page and TV detail page  
3. Create VideoPlayerModal component for iframe playback
4. Movie URL: `https://www.vidking.net/embed/movie/1{tmdbId}?nextEpisode=true&episodeSelector=true`
5. TV URL: `https://www.vidking.net/embed/tv/{tmdbId}/{season}/{episode}?nextEpisode=true&episodeSelector=true`

## Phase 2: TV Season/Episode Pages
1. Add TMDB season detail API query
2. Create dedicated season page with episode listing
3. Create episode detail page with play button
4. Season/episode navigation (prev/next episode, season selector)
5. Make seasons page clickable to individual season pages

## Phase 3: Enhanced Watchlist with Status Tracking
1. Extend WatchlistItem type with `status: 'not-started' | 'in-progress' | 'watched'`
2. Update Zustand store with status management 
3. Visual indicators on watchlist page (crossed-out for watched, highlighted for in-progress)
4. Filter/sort by status on watchlist page
5. localStorage persistence (already handled by Zustand persist)

## Phase 4: Loader & Transition Improvements
1. Skeleton loaders per section instead of full-page spinner
2. Animated transitions using CSS keyframes
3. Staggered list animations for media grids

## Phase 5: Visual Polish
1. Shadow/glass components for cards
2. Gradient accents and premium styling
3. Micro-animations and hover effects
