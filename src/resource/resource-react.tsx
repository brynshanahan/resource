import { createContext, useState, useEffect } from 'react'
import Resource from './resource'

const ResourceProvider = createContext()

const useResource = id => {
  const user = { id: 'test' }
  const [resource, setResource] = useState(() => {
    return new Resource(id, user.id)
  })
  useEffect(() => {
    setResource(new Resource(id, user.id))
  }, [id, user.id])
  return resource
}
