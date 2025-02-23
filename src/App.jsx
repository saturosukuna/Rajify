import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { 
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  ChevronDownIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/solid'

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [playlists, setPlaylists] = useState([])
  const [currentTracks, setCurrentTracks] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [language, setLanguage] = useState('tamil')
  const [currentTime, setCurrentTime] = useState('0:00')
  const playerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState('playlists') // 'playlists' or 'tracks'
  const [cachedPlaylists, setCachedPlaylists] = useState(new Map())

  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

  // YouTube Player Setup
  useEffect(() => {
    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    document.body.appendChild(tag)

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('player', {
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      })
    }
  }, [])

  const onPlayerReady = (event) => {
    event.target.setVolume(volume * 100)
  }

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.ENDED) {
      playNext()
    }
    setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
  }

  // Fetch popular playlists when language changes
  useEffect(() => {
    const fetchPopularPlaylists = async () => {
      const query = `${language} music playlists`
      try {
        const { data } = await axios.get(
          'https://www.googleapis.com/youtube/v3/search', {
            params: {
              part: 'snippet',
              q: query,
              type: 'playlist',
              maxResults: 10,
              key: YOUTUBE_API_KEY
            }
          }
        )
        setPlaylists(data.items)
      } catch (error) {
        console.error('Failed to fetch playlists:', error)
      }
    }
    
    fetchPopularPlaylists()
  }, [language, YOUTUBE_API_KEY])

  // Handle playlist selection
  const handlePlaylistSelect = async (playlistId) => {
    if (cachedPlaylists.has(playlistId)) {
      setCurrentTracks(cachedPlaylists.get(playlistId))
      setViewMode('tracks')
      return
    }

    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/playlistItems', {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: 50,
            key: YOUTUBE_API_KEY
          }
        }
      )

      const tracks = data.items.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel: item.snippet.videoOwnerChannelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url
      }))

      setCachedPlaylists(new Map(cachedPlaylists.set(playlistId, tracks)))
      setCurrentTracks(tracks)
      setViewMode('tracks')
    } catch (error) {
      console.error('Failed to fetch playlist tracks:', error)
    }
  }

  // Playback controls
  const playTrack = (index) => {
    setCurrentIndex(index)
    setCurrentTrack(currentTracks[index])
    playerRef.current.loadVideoById(currentTracks[index].id)
    playerRef.current.playVideo()
  }

  const playNext = () => {
    const newIndex = (currentIndex + 1) % currentTracks.length
    playTrack(newIndex)
  }

  const playPrevious = () => {
    const newIndex = (currentIndex - 1 + currentTracks.length) % currentTracks.length
    playTrack(newIndex)
  }

  // Progress tracking
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const current = playerRef.current.getCurrentTime()
        const duration = playerRef.current.getDuration()
        setProgress((current / duration) * 100)
        setCurrentTime(formatDuration(current))
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-4">
        {viewMode === 'tracks' && (
          <button 
            onClick={() => setViewMode('playlists')}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
        )}
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MusicalNoteIcon className="h-8 w-8 text-green-500" />
          Rajify
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Language Selector */}
        <div className="mb-6 flex gap-2">
          {['tamil', 'english'].map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-4 py-2 rounded-full ${
                language === lang ? 'bg-green-500' : 'bg-gray-800'
              }`}
            >
              {lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={`Search ${language} playlists...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {viewMode === 'playlists' ? (
            playlists.map((playlist) => (
              <div
                key={playlist.id.playlistId}
                onClick={() => handlePlaylistSelect(playlist.id.playlistId)}
                className="bg-gray-800 p-4 rounded-xl hover:bg-gray-700 transition cursor-pointer"
              >
                <img
                  src={playlist.snippet.thumbnails?.medium?.url}
                  alt={playlist.snippet.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <h3 className="font-semibold truncate">{playlist.snippet.title}</h3>
                <p className="text-gray-400 text-sm truncate">
                  {playlist.snippet.channelTitle}
                </p>
              </div>
            ))
          ) : (
            currentTracks.map((track, index) => (
              <div
                key={track.id}
                onClick={() => playTrack(index)}
                className={`p-3 rounded-lg flex items-center gap-4 ${
                  currentTrack?.id === track.id ? 'bg-green-500/20' : 'bg-gray-800'
                } hover:bg-gray-700 transition cursor-pointer`}
              >
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="w-12 h-12 rounded-md"
                />
                <div className="min-w-0">
                  <h4 className="font-medium truncate">{track.title}</h4>
                  <p className="text-sm text-gray-400 truncate">{track.channel}</p>
                </div>
                {currentTrack?.id === track.id && (
                  <div className="ml-auto">
                    {isPlaying ? (
                      <PauseIcon className="h-6 w-6" />
                    ) : (
                      <PlayIcon className="h-6 w-6" />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Player Controls */}
      <div className="h-48 pb-5  border-t border-white/10 bg-black/80 backdrop-blur-lg p-4 fixed bottom-0 left-0 right-0">
      <div className="mx-auto flex flex-col md:flex-row items-center justify-between h-full max-w-7xl gap-4 overflow-hidden">
          {/* Track Info */}
          {currentTrack && (
            <div className="flex items-center gap-4 min-w-0 flex-1 w-full md:w-auto">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-14 h-14 rounded-md"
              />
              <div className="min-w-0">
                <h4 className="font-semibold truncate mb-1">{currentTrack.title}</h4>
                <p className="text-sm text-gray-400 truncate">{currentTrack.channel}</p>
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex flex-col items-center flex-1">
            <div className="flex items-center gap-4">
              <button
                onClick={playPrevious}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <BackwardIcon className="h-6 w-6" />
              </button>
              
              <button
                onClick={() => playerRef.current[isPlaying ? 'pauseVideo' : 'playVideo']()}
                className="p-4 bg-green-500 rounded-full hover:scale-105 transition"
              >
                {isPlaying ? (
                  <PauseIcon className="h-6 w-6 text-black" />
                ) : (
                  <PlayIcon className="h-6 w-6 text-black" />
                )}
              </button>

              <button
                onClick={playNext}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <ForwardIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full flex items-center gap-3">
            <span className="text-sm text-gray-400">{currentTime}</span>
              <div 
                className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.target.getBoundingClientRect()
                  const percent = (e.clientX - rect.left) / rect.width
                  playerRef.current.seekTo(percent * playerRef.current.getDuration())
                }}
              >
                <div 
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="hidden md:flex items-center gap-3 flex-1 justify-end min-w-[180px]">
            <SpeakerWaveIcon className="h-5 w-5 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value)
                setVolume(newVolume)
                playerRef.current.setVolume(newVolume * 100)
              }}
              className="w-24 accent-green-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div id="player" className="hidden" />
    </div>
  )
}