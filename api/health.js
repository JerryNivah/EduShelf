export default function handler(request, response) {
  response.status(200).json({
    service: 'edushelf-api',
    status: 'ok',
  })
}
