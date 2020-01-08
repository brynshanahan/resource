import { defineBlock, useField } from "./content";

defineBlock({
  name: "image"
})(props => {
  const [image, setImage] = useField("image");
  const [caption, setCaption] = useField("caption");
  return (
    <div>
      <input />
    </div>
  );
});
