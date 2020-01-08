import * as React from 'react'
import { render } from 'react-dom'
import { ScopedBlockPage } from '../pages/ScopedBlock/ScopedBlockPage'
import { NestedBlockPage } from '../pages/NestedBlock/NestedBlockPage'

import {
  BrowserRouter as Router,
  Route,
  Link,
  Switch,
  Redirect,
} from 'react-router-dom'

class ErrorLogger extends React.Component {
  componentDidCatch(e) {
    console.log(e)
  }
  render() {
    return <>{this.props.children}</>
  }
}

function App() {
  return (
    <ErrorLogger>
      <Router>
        <nav>
          <ul>
            <li>
              <Link to="/scoped">Scoped</Link>
            </li>
            <li>
              <Link to="/nested">Nested</Link>
            </li>
            <li>
              <a
                onClick={e => {
                  console.log(e)
                  e.preventDefault()
                  localStorage.clear()
                  window.location.reload()
                }}
              >
                Clear localstorage
              </a>
            </li>
          </ul>
        </nav>
        <Switch>
          <Route path="/scoped" component={ScopedBlockPage} />
          <Route path="/nested" component={NestedBlockPage} />
          <Route path="*" render={() => <Redirect to="/scoped" />} />
        </Switch>
      </Router>
    </ErrorLogger>
  )
}

const rootElement = document.getElementById('root')
render(<App />, rootElement)
