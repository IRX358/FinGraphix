
# FinGraphix: Financial Forensic Engine
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/sania08mehek/FinGraphix)

FinGraphix is a web application designed for intelligent data exploration and forensic analysis. Upload a CSV dataset, and the application's AI-powered engine will automatically generate a profile, recommend insightful visualizations, and provide a guided path for drilling down into your data.

## Features

- **Intuitive Data Upload**: Easily upload CSV files via a drag-and-drop interface.
- **Sample Dataset**: Instantly start exploring with a built-in sample dataset (Titanic).
- **Automated Data Profiling**: The system automatically analyzes the schema of your data, detecting column types (numeric, categorical, date), cardinality, and missing values.
- **AI-Powered Visualization**: Leverages an LLM (GPT-4o mini) to generate an overview of relevant charts, including histograms, bar charts, and scatter plots.
- **Guided Exploration**: Select any chart to enter a detailed view where the AI suggests relevant next steps, such as breaking down by another dimension, filtering to a specific segment, or comparing against other variables.
- **Interactive Charting**: All visualizations are rendered using Vega-Lite, providing interactive elements like tooltips.
- **Client-Side Persistence**: Your uploaded dataset is saved in your browser's local storage, allowing you to resume your analysis session.
- **Modern, Responsive UI**: Built with Next.js and Shadcn UI, featuring a professional dark theme, smooth animations, and a fully responsive layout for both desktop and mobile.

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Data Visualization**: [Vega-Lite](https://vega.github.io/vega-lite/)
- **AI & LLM Integration**: [Vercel AI SDK](https://sdk.vercel.ai/) with OpenAI's `gpt-4o-mini` model
- **Animations & Interactivity**: [Framer Motion](https://www.framer.com/motion/) (via `tailwindcss-animate`), `embla-carousel`, and custom React hooks.
- **Package Manager**: [pnpm](https://pnpm.io/)

## How It Works

1.  **Upload & Profile**: When a user uploads a CSV or loads the sample data, the file is sent to the backend (`/api/dataset/upload`). The server parses the CSV, infers data types, and generates a detailed profile for each column using the logic in `lib/profiler.ts`.

2.  **In-Memory & Local Storage**: The complete dataset and its profile are stored in an in-memory cache on the server (`lib/dataset-store.ts`). A copy is also sent to the client and saved in `localStorage` to enable session restoration (`lib/local-storage.ts`).

3.  **Initial Overview**: The user is redirected to the `/explore` page, which calls the `/api/recommend/overview` endpoint. This endpoint uses a recommender system (`lib/recommender.ts`) to generate a set of initial charts (histograms for numeric data, bar charts for categorical data, and scatter plots for correlated pairs).

4.  **Drill-Down Exploration**: Clicking on a chart opens an expanded modal (`components/chart-expanded-modal.tsx`). This modal fetches AI-powered drill-down suggestions from `/api/llm/drilldown`.

5.  **Guided Chart Generation**: When a user selects a drill-down option (e.g., "Break down by ColumnName"), a request is made to `/api/recommend/drilldown`. This endpoint uses the `lib/chart-generator.ts` utility to create new Vega-Lite specifications based on the user's intent, which are then displayed as new chart thumbnails.

## Project Structure

The repository is organized following standard Next.js App Router conventions.

```
/
├── app/
│   ├── api/                # Backend API routes for data, LLM, and recommendations
│   │   ├── dataset/        # Handles upload, profiling, and data restoration
│   │   ├── llm/            # Interfaces with the OpenAI model for insights
│   │   └── recommend/      # Generates visualization recommendations
│   ├── explore/            # Main data exploration and visualization page
│   ├── processing/         # Loading page shown while the dataset is analyzed
│   └── page.tsx            # Homepage with the data upload zone
│
├── components/
│   ├── ui/                 # Reusable UI components from Shadcn
│   ├── chart-expanded-modal.tsx # Modal for deep-dive analysis
│   ├── chart-grid.tsx      # Renders the grid of visualization thumbnails
│   ├── upload-dropzone.tsx # Drag-and-drop file upload component
│   └── vega-chart.tsx      # React wrapper for rendering Vega-Lite specs
│
├── hooks/
│   └── use-scroll-reveal.ts # Custom hook for scroll-based animations
│
└── lib/
    ├── chart-generator.ts  # Functions to create Vega-Lite JSON specs
    ├── profiler.ts         # Logic for CSV parsing and data profiling
    ├── recommender.ts      # Core logic for recommending visualizations
    ├── dataset-store.ts    # In-memory server-side cache for datasets
    └── types.ts            # TypeScript type definitions for the project
```

## Getting Started

To run FinGraphix locally, follow these steps:

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/sania08mehek/FinGraphix.git
    cd FinGraphix
    ```

2.  **Install Dependencies**

    This project uses `pnpm` as the package manager.

    ```bash
    pnpm install
    ```

3.  **Set Up Environment Variables**

    This project uses the Vercel AI SDK with OpenAI. You will need to create a `.env.local` file in the root directory and add your OpenAI API key.

    ```bash
    OPENAI_API_KEY="your-openai-api-key"
    ```

4.  **Run the Development Server**

    ```bash
    pnpm dev
    ```

    The application will be available at `http://localhost:3000`.

5.  **Build for Production**

    To create a production-ready build, run:

    ```bash
    pnpm build
