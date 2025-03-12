# ChatToMyDoc (document-chat-rag)

ChatToMyDoc is a React application that allows you to upload documents and have targeted conversations using a Retrieval Augmented Generation (RAG) model.

Try it out https://chattomydoc.netlify.app

## Features

* Document Upload
* RAG-based conversational interface
* React + Vite frontend

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jonnymuir/document-chat-rag.git
    cd document-chat-rag
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
4.  **Open your browser:** Navigate to `http://localhost:5173`.

## Deployment to Netlify

1.  **Create a Netlify account:** If you don't have one, sign up at [netlify.com](https://www.netlify.com/).
2.  **Connect your GitHub repository:**
    * In your Netlify dashboard, click "Add new site" and then "Import an existing project."
    * Select "Deploy with GitHub."
    * Authorize Netlify to access your GitHub account.
    * Choose your `document-chat-rag` repository.
3.  **Configure build settings:**
    * **Build command:** `npm run build`
    * **Publish directory:** `dist`
4.  **Deploy your site:** Click "Deploy site."
5.  **Environment Variables:** If your application uses environment variables, add them in the Netlify dashboard under "Site settings" -> "Build & deploy" -> "Environment."

## Future Enhancements

* Add more RAG model options.
* Implement user authentication.
* Improve UI/UX.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

MIT