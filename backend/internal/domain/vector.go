package domain

import (
	"math"

	"github.com/go-gl/mathgl/mgl32"
)

type Vector3 struct {
	X float32 `json:"x" msgpack:"x"`
	Y float32 `json:"y" msgpack:"y"`
	Z float32 `json:"z" msgpack:"z"`
}

func (v Vector3) DistanceTo(other Vector3) float32 {
	dx := v.X - other.X
	dz := v.Z - other.Z
	return float32(math.Sqrt(float64(dx*dx + dz*dz)))
}

func (v Vector3) Lerp(other Vector3, t float32) Vector3 {
	v1 := mgl32.Vec3{v.X, v.Y, v.Z}
	v2 := mgl32.Vec3{other.X, other.Y, other.Z}
	res := v1.Add(v2.Sub(v1).Mul(t))
	return Vector3{
		X: res.X(),
		Y: res.Y(),
		Z: res.Z(),
	}
}
