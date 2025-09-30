// Type for the base parameter - CSS variables and styles

// Generate themes
import themes from "./themes.json"

function App() {
  return (
    <div
      className=" flex flex-col items-center justify-center h-screen"
      data-theme="forest"
    >
      <div className="bg-base-100 p-4 rounded-lg">
        <h1 className="text-2xl text-primary font-bold">
          DaisyUI Variable Generator Imported themes
          {/* {JSON.stringify(themes)} */}
          <div className="flex gap-2 mt-8">
            <div
              style={{ backgroundColor: themes?.forest.primary }}
              className="rounded-full h-10 w-10"
            />
            <div
              style={{ backgroundColor: themes?.forest.secondary }}
              className="rounded-full h-10 w-10"
            />
          </div>
        </h1>
      </div>
    </div>
  )
}

export default App
